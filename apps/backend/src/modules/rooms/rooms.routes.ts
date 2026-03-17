import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient, RoomStatus } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/rbac';
import { recordAudit } from '../../services/audit.service';

const prisma = new PrismaClient();

// ─── Validation schemas ───────────────────────────────────────

const availabilityQuerySchema = z.object({
  check_in: z.string().date('Formato esperado: YYYY-MM-DD'),
  check_out: z.string().date('Formato esperado: YYYY-MM-DD'),
  type: z.enum(['standard', 'deluxe', 'suite', 'master_suite']).optional(),
  capacity: z.coerce.number().min(1).optional(),
});

const statusUpdateSchema = z.object({
  status: z.enum(['available', 'occupied', 'dirty', 'maintenance', 'blocked']),
  reason: z.string().max(255).optional(),
});

const createRoomSchema = z.object({
  number:      z.string().min(1).max(10),
  type:        z.enum(['standard', 'deluxe', 'suite', 'master_suite']),
  floor:       z.number().int().min(0),
  capacity:    z.number().int().min(1).max(20).default(2),
  basePrice:   z.number().positive(),
  description: z.string().max(500).optional(),
});

const updateRoomSchema = createRoomSchema.partial();

// ─── Routes ──────────────────────────────────────────────────

export async function roomRoutes(app: FastifyInstance) {

  // GET /rooms — list all rooms (admin/reception)
  app.get('/rooms', { preHandler: [authenticate, authorize('rooms:read')] }, async (request, reply) => {
    const { status, type, floor, page = '1', limit = '50' } = request.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type)   where.type   = type;
    if (floor)  where.floor  = Number(floor);

    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: [{ floor: 'asc' }, { number: 'asc' }],
        include: { _count: { select: { reservations: true } } },
      }),
      prisma.room.count({ where }),
    ]);

    return reply.send({ data: rooms, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  // GET /rooms/:id
  app.get('/rooms/:id', { preHandler: [authenticate, authorize('rooms:read')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        _count: { select: { reservations: true } },
        statusHistory: { orderBy: { changedAt: 'desc' }, take: 10, include: { changedBy: { select: { name: true } } } },
      },
    });
    if (!room) return reply.status(404).send({ error: 'Quarto não encontrado.' });
    return reply.send({ data: room });
  });

  // POST /rooms
  app.post('/rooms', { preHandler: [authenticate, authorize('rooms:write')] }, async (request, reply) => {
    const body = createRoomSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const existing = await prisma.room.findUnique({ where: { number: body.data.number } });
    if (existing) return reply.status(409).send({ error: `Quarto ${body.data.number} já cadastrado.` });

    const room = await prisma.room.create({ data: body.data });
    await recordAudit({ userId: request.user.sub, entityType: 'room', entityId: room.id, action: 'create', newValues: body.data, ipAddress: request.ip });
    return reply.status(201).send({ data: room });
  });

  // PUT /rooms/:id
  app.put('/rooms/:id', { preHandler: [authenticate, authorize('rooms:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateRoomSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const existing = await prisma.room.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Quarto não encontrado.' });

    if (body.data.number && body.data.number !== existing.number) {
      const conflict = await prisma.room.findUnique({ where: { number: body.data.number } });
      if (conflict) return reply.status(409).send({ error: `Número ${body.data.number} já está em uso.` });
    }

    const room = await prisma.room.update({ where: { id }, data: body.data });
    await recordAudit({ userId: request.user.sub, entityType: 'room', entityId: id, action: 'update', oldValues: existing as Record<string, unknown>, newValues: body.data, ipAddress: request.ip });
    return reply.send({ data: room });
  });

  // DELETE /rooms/:id — only if no reservations
  app.delete('/rooms/:id', { preHandler: [authenticate, authorize('rooms:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.room.findUnique({ where: { id }, include: { _count: { select: { reservations: true } } } });
    if (!existing) return reply.status(404).send({ error: 'Quarto não encontrado.' });
    if (existing._count.reservations > 0) return reply.status(409).send({ error: 'Quarto possui reservas e não pode ser excluído. Use status "bloqueado" para retirar de circulação.' });

    await prisma.room.delete({ where: { id } });
    await recordAudit({ userId: request.user.sub, entityType: 'room', entityId: id, action: 'delete', oldValues: existing as Record<string, unknown>, ipAddress: request.ip });
    return reply.status(204).send();
  });

  // GET /rooms/availability?check_in=&check_out=&type=&capacity=
  // Returns rooms with occupation calendar for the given period
  app.get(
    '/rooms/availability',
    { preHandler: [authenticate, authorize('rooms:read')] },
    async (request, reply) => {
      const query = availabilityQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({ error: 'Parâmetros inválidos.', details: query.error.flatten() });
      }

      const { check_in, check_out, type, capacity } = query.data;
      const checkIn = new Date(check_in);
      const checkOut = new Date(check_out);

      if (checkIn >= checkOut) {
        return reply.status(400).send({ error: 'A data de check-out deve ser posterior ao check-in.' });
      }

      // Rooms occupied during the requested window
      const occupiedRoomIds = await prisma.reservation.findMany({
        where: {
          status: { in: ['confirmed', 'checked_in', 'pending'] },
          AND: [
            { checkInDate: { lt: checkOut } },
            { checkOutDate: { gt: checkIn } },
          ],
        },
        select: { roomId: true },
      });

      const occupiedIds = occupiedRoomIds.map((r) => r.roomId);

      const rooms = await prisma.room.findMany({
        where: {
          ...(type && { type }),
          ...(capacity && { capacity: { gte: capacity } }),
        },
        orderBy: [{ floor: 'asc' }, { number: 'asc' }],
      });

      // Enrich each room with its reservations in the period for calendar rendering
      const reservations = await prisma.reservation.findMany({
        where: {
          status: { in: ['confirmed', 'checked_in', 'pending'] },
          AND: [
            { checkInDate: { lt: checkOut } },
            { checkOutDate: { gt: checkIn } },
          ],
        },
        include: { guest: { select: { fullName: true } } },
      });

      const roomsWithStatus = rooms.map((room) => {
        const roomReservations = reservations.filter((res) => res.roomId === room.id);
        return {
          ...room,
          isAvailable: !occupiedIds.includes(room.id),
          reservations: roomReservations.map((res) => ({
            id: res.id,
            guestName: res.guest.fullName,
            checkIn: res.checkInDate,
            checkOut: res.checkOutDate,
            status: res.status,
          })),
        };
      });

      return reply.send({ data: roomsWithStatus, period: { checkIn, checkOut } });
    },
  );

  // PATCH /rooms/:id/status — housekeeping marks room as clean/maintenance
  app.patch(
    '/rooms/:id/status',
    { preHandler: [authenticate, authorize('rooms:status_update')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = statusUpdateSchema.safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });
      }

      const { status, reason } = body.data;

      // Housekeeping can only toggle dirty → available (or maintenance)
      if (request.user.role === 'housekeeping') {
        const allowed: RoomStatus[] = ['available', 'maintenance'];
        if (!allowed.includes(status as RoomStatus)) {
          return reply.status(403).send({ error: 'Housekeeping só pode marcar quartos como Limpo ou Manutenção.' });
        }
      }

      const room = await prisma.room.findUnique({ where: { id } });
      if (!room) return reply.status(404).send({ error: 'Quarto não encontrado.' });

      const updatedRoom = await prisma.$transaction(async (tx) => {
        const updated = await tx.room.update({
          where: { id },
          data: { status: status as RoomStatus },
        });

        await tx.roomStatusHistory.create({
          data: {
            roomId: id,
            changedById: request.user.sub,
            oldStatus: room.status,
            newStatus: status as RoomStatus,
            reason,
          },
        });

        return updated;
      });

      await recordAudit({
        userId: request.user.sub,
        entityType: 'room',
        entityId: id,
        action: 'update',
        oldValues: { status: room.status },
        newValues: { status },
        ipAddress: request.ip,
      });

      return reply.send({ data: updatedRoom });
    },
  );

  // GET /rooms/housekeeping — dirty rooms for camareiras
  app.get(
    '/rooms/housekeeping',
    { preHandler: [authenticate, authorize('rooms:read')] },
    async (_request, reply) => {
      const rooms = await prisma.room.findMany({
        where: { status: { in: ['dirty', 'maintenance'] } },
        orderBy: [{ floor: 'asc' }, { number: 'asc' }],
      });

      return reply.send({ data: rooms });
    },
  );
}
