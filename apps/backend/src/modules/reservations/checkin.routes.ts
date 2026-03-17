import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/rbac';
import { recordAudit } from '../../services/audit.service';

const prisma = new PrismaClient();

const checkInBodySchema = z.object({
  guestNotes: z.string().max(500).optional(),
});

export async function checkInRoutes(app: FastifyInstance) {

  /**
   * POST /reservations/:id/check-in
   *
   * Flow:
   *  1. Validate reservation is confirmed and check-in date is today ±1
   *  2. Mark reservation as checked_in + set actual_check_in timestamp
   *  3. Mark room as occupied
   *  4. Create the invoice (open) for this stay
   *  5. Create the first transaction: daily-rate charges for all nights
   *  6. Write audit log
   *  7. Return full reservation with invoice
   */
  app.post(
    '/reservations/:id/check-in',
    { preHandler: [authenticate, authorize('reservations:write')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = checkInBodySchema.safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });
      }

      const reservation = await prisma.reservation.findUnique({
        where: { id },
        include: { room: true, guest: true },
      });

      if (!reservation) {
        return reply.status(404).send({ error: 'Reserva não encontrada.' });
      }

      if (reservation.status !== 'confirmed' && reservation.status !== 'pending') {
        return reply.status(409).send({
          error: `Não é possível fazer check-in. Status atual da reserva: ${reservation.status}`,
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkInDay = new Date(reservation.checkInDate);
      checkInDay.setHours(0, 0, 0, 0);
      const diffDays = Math.abs((today.getTime() - checkInDay.getTime()) / 86_400_000);

      if (diffDays > 1) {
        return reply.status(409).send({
          error: 'Check-in só pode ser realizado no dia da reserva ou com 1 dia de antecedência.',
        });
      }

      // ── Atomic transaction block ──────────────────────────────
      const result = await prisma.$transaction(async (tx) => {
        // 1. Update reservation status
        const updatedReservation = await tx.reservation.update({
          where: { id },
          data: {
            status: 'checked_in',
            actualCheckIn: new Date(),
            ...(body.data.guestNotes && { notes: body.data.guestNotes }),
          },
          include: { room: true, guest: true },
        });

        // 2. Mark room as occupied
        await tx.room.update({
          where: { id: reservation.roomId },
          data: { status: 'occupied' },
        });

        // 3. Track room status change
        await tx.roomStatusHistory.create({
          data: {
            roomId: reservation.roomId,
            changedById: request.user.sub,
            oldStatus: reservation.room.status,
            newStatus: 'occupied',
            reason: `Check-in reserva #${id}`,
          },
        });

        // 4. Create open invoice
        const invoice = await tx.invoice.create({
          data: {
            reservationId: id,
            subtotal: reservation.baseAmount,
            discounts: reservation.discount,
            taxes: 0,
            total: reservation.totalAmount,
            status: 'open',
          },
        });

        // 5. Create daily-rate transaction for the full stay
        const nights = Math.ceil(
          (new Date(reservation.checkOutDate).getTime() - new Date(reservation.checkInDate).getTime()) / 86_400_000,
        );

        await tx.transaction.create({
          data: {
            reservationId: id,
            createdById: request.user.sub,
            category: 'daily_rate',
            description: `${nights} diária(s) — quarto ${reservation.room.number}`,
            amount: reservation.baseAmount,
            status: 'pending',
          },
        });

        return { reservation: updatedReservation, invoice };
      });
      // ─────────────────────────────────────────────────────────

      await recordAudit({
        userId: request.user.sub,
        entityType: 'reservation',
        entityId: id,
        action: 'update',
        oldValues: { status: reservation.status },
        newValues: { status: 'checked_in', actualCheckIn: new Date() },
        ipAddress: request.ip,
      });

      return reply.status(200).send({
        message: 'Check-in realizado com sucesso.',
        data: result,
      });
    },
  );
}
