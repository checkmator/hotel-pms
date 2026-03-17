import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient, TransactionStatus } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/rbac';
import { recordAudit } from '../../services/audit.service';

const prisma = new PrismaClient();

const TAX_RATE = 0.05; // 5% ISS sobre serviços

const checkOutBodySchema = z.object({
  paymentMethod: z.enum(['cash', 'credit_card', 'debit_card', 'pix', 'bank_transfer', 'invoice']),
  discountOverride: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export async function checkOutRoutes(app: FastifyInstance) {

  /**
   * POST /reservations/:id/check-out
   *
   * Fluxo completo de check-out e fechamento de fatura:
   *
   *  1.  Valida que a reserva está em status checked_in
   *  2.  Carrega todas as transações pendentes da reserva
   *  3.  Calcula subtotal, ISS, desconto final e total
   *  4.  Marca todas as transações como "paid"
   *  5.  Fecha a invoice (status: closed, closedAt: now)
   *  6.  Atualiza a reserva: status → checked_out, actual_check_out → now
   *  7.  Libera o quarto: status → dirty (aguarda limpeza)
   *  8.  Registra histórico de status do quarto
   *  9.  Persiste audit log da alteração financeira
   *  10. Retorna fatura consolidada ao chamador
   */
  app.post(
    '/reservations/:id/check-out',
    { preHandler: [authenticate, authorize('invoices:close')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = checkOutBodySchema.safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });
      }

      // ── Load reservation with all related data ─────────────
      const reservation = await prisma.reservation.findUnique({
        where: { id },
        include: {
          room: true,
          guest: true,
          transactions: {
            where: {
              status: { in: ['pending'] as TransactionStatus[] },
            },
          },
          invoices: {
            where: { status: 'open' },
          },
        },
      });

      if (!reservation) {
        return reply.status(404).send({ error: 'Reserva não encontrada.' });
      }

      if (reservation.status !== 'checked_in') {
        return reply.status(409).send({
          error: `Check-out inválido. Status atual da reserva: ${reservation.status}`,
        });
      }

      const openInvoice = reservation.invoices[0];
      if (!openInvoice) {
        return reply.status(409).send({ error: 'Fatura em aberto não encontrada para esta reserva.' });
      }

      // ── Financial calculations ─────────────────────────────
      const subtotal = reservation.transactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0,
      );

      const discount = body.data.discountOverride !== undefined
        ? body.data.discountOverride
        : Number(reservation.discount);

      const taxableAmount = Math.max(subtotal - discount, 0);
      const taxes = parseFloat((taxableAmount * TAX_RATE).toFixed(2));
      const total = parseFloat((taxableAmount + taxes).toFixed(2));

      const actualCheckOut = new Date();

      // ── Capture old values for audit ───────────────────────
      const auditOldValues = {
        reservationStatus: reservation.status,
        invoiceStatus: openInvoice.status,
        roomStatus: reservation.room.status,
        originalTotal: openInvoice.total,
      };

      // ── Atomic transaction block ───────────────────────────
      const result = await prisma.$transaction(async (tx) => {
        // 1. Mark all pending transactions as paid with the chosen method
        await tx.transaction.updateMany({
          where: {
            reservationId: id,
            status: 'pending',
          },
          data: {
            status: 'paid',
            paymentMethod: body.data.paymentMethod,
          },
        });

        // 2. Close the invoice
        const closedInvoice = await tx.invoice.update({
          where: { id: openInvoice.id },
          data: {
            subtotal,
            taxes,
            discounts: discount,
            total,
            status: 'closed',
            closedAt: actualCheckOut,
            closedById: request.user.sub,
          },
        });

        // 3. Update reservation
        const updatedReservation = await tx.reservation.update({
          where: { id },
          data: {
            status: 'checked_out',
            actualCheckOut,
            totalAmount: total,
            ...(body.data.notes && { notes: body.data.notes }),
          },
          include: {
            guest: true,
            room: true,
            transactions: { orderBy: { transactionDate: 'asc' } },
          },
        });

        // 4. Release room → dirty (must be cleaned before next check-in)
        await tx.room.update({
          where: { id: reservation.roomId },
          data: { status: 'dirty' },
        });

        // 5. Room status history
        await tx.roomStatusHistory.create({
          data: {
            roomId: reservation.roomId,
            changedById: request.user.sub,
            oldStatus: 'occupied',
            newStatus: 'dirty',
            reason: `Check-out reserva #${id}`,
          },
        });

        return { reservation: updatedReservation, invoice: closedInvoice };
      });
      // ──────────────────────────────────────────────────────

      // Audit: financial closure must always be traceable
      await recordAudit({
        userId: request.user.sub,
        entityType: 'reservation',
        entityId: id,
        action: 'update',
        oldValues: auditOldValues,
        newValues: {
          reservationStatus: 'checked_out',
          invoiceStatus: 'closed',
          roomStatus: 'dirty',
          subtotal,
          taxes,
          discount,
          total,
          paymentMethod: body.data.paymentMethod,
          actualCheckOut,
        },
        ipAddress: request.ip,
      });

      // ── Build consolidated invoice response ────────────────
      const { reservation: res, invoice } = result;

      return reply.status(200).send({
        message: 'Check-out realizado e fatura fechada com sucesso.',
        data: {
          reservation: {
            id: res.id,
            guest: { id: res.guest.id, name: res.guest.fullName, cpf: res.guest.cpfPassport },
            room: { id: res.room.id, number: res.room.number, type: res.room.type },
            checkIn: res.actualCheckIn,
            checkOut: res.actualCheckOut,
            nights: Math.ceil(
              (actualCheckOut.getTime() - (res.actualCheckIn?.getTime() ?? 0)) / 86_400_000,
            ),
          },
          invoice: {
            id: invoice.id,
            subtotal: invoice.subtotal,
            taxes: invoice.taxes,
            discounts: invoice.discounts,
            total: invoice.total,
            paymentMethod: body.data.paymentMethod,
            closedAt: invoice.closedAt,
            status: invoice.status,
          },
          lineItems: res.transactions.map((t) => ({
            id: t.id,
            category: t.category,
            description: t.description,
            amount: t.amount,
            date: t.transactionDate,
            status: t.status,
          })),
        },
      });
    },
  );

  // GET /reservations/:id/invoice — preview fatura antes do check-out
  app.get(
    '/reservations/:id/invoice',
    { preHandler: [authenticate, authorize('transactions:read')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const reservation = await prisma.reservation.findUnique({
        where: { id },
        include: {
          guest: { select: { fullName: true, cpfPassport: true, email: true } },
          room: { select: { number: true, type: true } },
          transactions: {
            where: { status: { not: 'cancelled' } },
            orderBy: { transactionDate: 'asc' },
          },
          invoices: { orderBy: { createdAt: 'desc' as const }, take: 1 },
        },
      });

      if (!reservation) {
        return reply.status(404).send({ error: 'Reserva não encontrada.' });
      }

      const closedInvoice = reservation.invoices.find((inv) => inv.status === 'closed');
      let subtotal: number, discount: number, taxes: number, total: number;

      if (closedInvoice) {
        // Use persisted financials for closed invoices
        subtotal = Number(closedInvoice.subtotal);
        discount = Number(closedInvoice.discounts);
        taxes    = Number(closedInvoice.taxes);
        total    = Number(closedInvoice.total);
      } else {
        subtotal = reservation.transactions.reduce(
          (sum, t) => t.status !== 'refunded' ? sum + Number(t.amount) : sum,
          0,
        );
        discount = Number(reservation.discount);
        const taxableAmount = Math.max(subtotal - discount, 0);
        taxes = parseFloat((taxableAmount * TAX_RATE).toFixed(2));
        total = parseFloat((taxableAmount + taxes).toFixed(2));
      }

      return reply.send({
        data: {
          reservation: {
            id: reservation.id,
            status: reservation.status,
            checkInDate: reservation.checkInDate,
            checkOutDate: reservation.checkOutDate,
            actualCheckIn: reservation.actualCheckIn,
            actualCheckOut: reservation.actualCheckOut,
          },
          guest: reservation.guest,
          room: reservation.room,
          lineItems: reservation.transactions,
          summary: { subtotal, discount, taxes, total },
          invoiceId: closedInvoice?.id ?? reservation.invoices[0]?.id ?? null,
          invoiceStatus: reservation.invoices[0]?.status ?? 'no_invoice',
          paymentMethod: closedInvoice ? (reservation.transactions[0]?.paymentMethod ?? null) : null,
          closedAt: closedInvoice?.closedAt ?? null,
        },
      });
    },
  );
}
