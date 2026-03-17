import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/rbac';
import { recordAudit } from '../../services/audit.service';

const prisma = new PrismaClient();

const createTransactionSchema = z.object({
  category: z.enum(['daily_rate', 'minibar', 'laundry', 'restaurant', 'room_service', 'parking', 'extra']),
  description: z.string().min(3).max(255),
  amount: z.number().positive('O valor deve ser positivo.'),
});

export async function transactionRoutes(app: FastifyInstance) {

  /**
   * POST /reservations/:id/transactions
   * Lança consumo em tempo real na conta do hóspede.
   */
  app.post(
    '/reservations/:id/transactions',
    { preHandler: [authenticate, authorize('transactions:write')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = createTransactionSchema.safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });
      }

      const reservation = await prisma.reservation.findUnique({ where: { id } });

      if (!reservation) {
        return reply.status(404).send({ error: 'Reserva não encontrada.' });
      }

      if (reservation.status !== 'checked_in') {
        return reply.status(409).send({
          error: 'Só é possível lançar consumo em reservas com check-in ativo.',
        });
      }

      const [transaction] = await prisma.$transaction([
        prisma.transaction.create({
          data: {
            reservationId: id,
            createdById: request.user.sub,
            category: body.data.category,
            description: body.data.description,
            amount: body.data.amount,
            status: 'pending',
          },
        }),
        // Update the open invoice total in real-time
        prisma.invoice.updateMany({
          where: { reservationId: id, status: 'open' },
          data: { total: { increment: body.data.amount }, subtotal: { increment: body.data.amount } },
        }),
      ]);

      await recordAudit({
        userId: request.user.sub,
        entityType: 'transaction',
        entityId: transaction.id,
        action: 'create',
        newValues: { ...body.data, reservationId: id },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        message: 'Consumo lançado com sucesso.',
        data: transaction,
      });
    },
  );

  // GET /reservations/:id/transactions — current account statement
  app.get(
    '/reservations/:id/transactions',
    { preHandler: [authenticate, authorize('transactions:read')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const [transactions, invoice] = await Promise.all([
        prisma.transaction.findMany({
          where: { reservationId: id },
          orderBy: { transactionDate: 'asc' },
          include: { createdBy: { select: { name: true } } },
        }),
        prisma.invoice.findFirst({
          where: { reservationId: id, status: 'open' },
        }),
      ]);

      const total = transactions
        .filter((t) => t.status !== 'cancelled' && t.status !== 'refunded')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      return reply.send({ data: { transactions, invoice, runningTotal: total } });
    },
  );
}
