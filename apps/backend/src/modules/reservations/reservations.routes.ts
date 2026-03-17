import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/rbac';
import { recordAudit } from '../../services/audit.service';

const prisma = new PrismaClient();

const createSchema = z.object({
  guestId:     z.string().uuid(),
  roomId:      z.string().uuid(),
  checkInDate:  z.string().date(),
  checkOutDate: z.string().date(),
  discount:    z.number().min(0).default(0),
  notes:       z.string().max(500).optional(),
}).refine((d) => new Date(d.checkOutDate) > new Date(d.checkInDate), {
  message: 'Check-out deve ser posterior ao check-in.',
  path: ['checkOutDate'],
});

const updateSchema = z.object({
  checkInDate:  z.string().date().optional(),
  checkOutDate: z.string().date().optional(),
  discount:    z.number().min(0).optional(),
  notes:       z.string().max(500).optional(),
  status:      z.enum(['pending', 'confirmed', 'cancelled']).optional(),
});

export async function reservationRoutes(app: FastifyInstance) {

  // GET /reservations
  app.get('/reservations', { preHandler: [authenticate, authorize('reservations:read')] }, async (request, reply) => {
    const { status, guestId, roomId, page = '1', limit = '20', from, to } = request.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (status)  where.status  = status;
    if (guestId) where.guestId = guestId;
    if (roomId)  where.roomId  = roomId;
    if (from || to) {
      where.checkInDate = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      };
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { checkInDate: 'desc' },
        include: {
          guest: { select: { id: true, fullName: true, cpfPassport: true, phone: true } },
          room:  { select: { id: true, number: true, type: true, floor: true } },
        },
      }),
      prisma.reservation.count({ where }),
    ]);

    return reply.send({ data: reservations, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  // GET /reservations/:id
  app.get('/reservations/:id', { preHandler: [authenticate, authorize('reservations:read')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        guest: true,
        room: true,
        transactions: { orderBy: { transactionDate: 'asc' } },
        invoices: true,
      },
    });
    if (!reservation) return reply.status(404).send({ error: 'Reserva não encontrada.' });
    return reply.send({ data: reservation });
  });

  // POST /reservations
  app.post('/reservations', { preHandler: [authenticate, authorize('reservations:write')] }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const { guestId, roomId, checkInDate, checkOutDate, discount, notes } = body.data;
    const checkIn  = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    // Verify guest and room exist
    const [guest, room] = await Promise.all([
      prisma.guest.findUnique({ where: { id: guestId } }),
      prisma.room.findUnique({ where: { id: roomId } }),
    ]);
    if (!guest) return reply.status(404).send({ error: 'Hóspede não encontrado.' });
    if (!room)  return reply.status(404).send({ error: 'Quarto não encontrado.'  });
    if (room.status === 'maintenance' || room.status === 'blocked') {
      return reply.status(409).send({ error: `Quarto ${room.number} está em ${room.status} e não pode ser reservado.` });
    }

    // Check for conflicting reservations
    const conflict = await prisma.reservation.findFirst({
      where: {
        roomId,
        status: { in: ['pending', 'confirmed', 'checked_in'] },
        AND: [{ checkInDate: { lt: checkOut } }, { checkOutDate: { gt: checkIn } }],
      },
    });
    if (conflict) return reply.status(409).send({ error: 'Quarto já reservado nesse período.' });

    // Calculate amount
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
    const baseAmount  = Number(room.basePrice) * nights;
    const totalAmount = Math.max(baseAmount - discount, 0);

    const reservation = await prisma.reservation.create({
      data: {
        guestId, roomId,
        createdById: request.user.sub,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        status: 'confirmed',
        baseAmount,
        discount,
        totalAmount,
        notes,
      },
      include: {
        guest: { select: { id: true, fullName: true, cpfPassport: true } },
        room:  { select: { id: true, number: true, type: true } },
      },
    });

    await recordAudit({ userId: request.user.sub, entityType: 'reservation', entityId: reservation.id, action: 'create', newValues: { guestId, roomId, checkInDate, checkOutDate, baseAmount, totalAmount }, ipAddress: request.ip });
    return reply.status(201).send({ data: reservation });
  });

  // PATCH /reservations/:id — update dates/discount/notes or status (confirm/cancel)
  app.patch('/reservations/:id', { preHandler: [authenticate, authorize('reservations:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const existing = await prisma.reservation.findUnique({ where: { id }, include: { room: true } });
    if (!existing) return reply.status(404).send({ error: 'Reserva não encontrada.' });

    const immutable = ['checked_in', 'checked_out'];
    if (immutable.includes(existing.status)) {
      return reply.status(409).send({ error: `Reserva com status "${existing.status}" não pode ser alterada.` });
    }

    // Recalculate amount if dates changed
    let baseAmount  = Number(existing.baseAmount);
    let totalAmount = Number(existing.totalAmount);
    const discount  = body.data.discount ?? Number(existing.discount);

    if (body.data.checkInDate || body.data.checkOutDate) {
      const checkIn  = new Date(body.data.checkInDate  ?? existing.checkInDate);
      const checkOut = new Date(body.data.checkOutDate ?? existing.checkOutDate);
      const nights   = Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
      baseAmount  = Number(existing.room.basePrice) * nights;
      totalAmount = Math.max(baseAmount - discount, 0);
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        ...(body.data.checkInDate  && { checkInDate:  new Date(body.data.checkInDate)  }),
        ...(body.data.checkOutDate && { checkOutDate: new Date(body.data.checkOutDate) }),
        ...(body.data.status       && { status: body.data.status }),
        ...(body.data.notes !== undefined && { notes: body.data.notes }),
        discount,
        baseAmount,
        totalAmount,
      },
      include: {
        guest: { select: { id: true, fullName: true } },
        room:  { select: { id: true, number: true } },
      },
    });

    await recordAudit({ userId: request.user.sub, entityType: 'reservation', entityId: id, action: 'update', oldValues: existing as unknown as Record<string, unknown>, newValues: body.data, ipAddress: request.ip });
    return reply.send({ data: updated });
  });

  // DELETE /reservations/:id — cancel only
  app.delete('/reservations/:id', { preHandler: [authenticate, authorize('reservations:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.reservation.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Reserva não encontrada.' });

    if (['checked_in', 'checked_out'].includes(existing.status)) {
      return reply.status(409).send({ error: 'Reserva em andamento não pode ser cancelada.' });
    }

    const cancelled = await prisma.reservation.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    await recordAudit({ userId: request.user.sub, entityType: 'reservation', entityId: id, action: 'delete', oldValues: { status: existing.status }, newValues: { status: 'cancelled' }, ipAddress: request.ip });
    return reply.send({ data: cancelled });
  });
}
