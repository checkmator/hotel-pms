import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/rbac';
import { recordAudit } from '../../services/audit.service';

const prisma = new PrismaClient();

const createGuestSchema = z.object({
  fullName:    z.string().min(2).max(120),
  cpfPassport: z.string().min(5).max(20),
  email:       z.string().email().optional().or(z.literal('')),
  phone:       z.string().max(20).optional(),
  nationality: z.string().max(60).optional(),
  birthDate:   z.string().date().optional(),
  address:     z.string().max(300).optional(),
  notes:       z.string().max(500).optional(),
});

const updateGuestSchema = createGuestSchema.partial();

export async function guestRoutes(app: FastifyInstance) {

  // GET /guests?search=&page=&limit=
  app.get('/guests', { preHandler: [authenticate, authorize('guests:read')] }, async (request, reply) => {
    const { search = '', page = '1', limit = '20' } = request.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where = search
      ? {
          OR: [
            { fullName:    { contains: search, mode: 'insensitive' as const } },
            { cpfPassport: { contains: search, mode: 'insensitive' as const } },
            { email:       { contains: search, mode: 'insensitive' as const } },
            { phone:       { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [guests, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { fullName: 'asc' },
        include: { _count: { select: { reservations: true } } },
      }),
      prisma.guest.count({ where }),
    ]);

    return reply.send({ data: guests, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  // GET /guests/:id
  app.get('/guests/:id', { preHandler: [authenticate, authorize('guests:read')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const guest = await prisma.guest.findUnique({
      where: { id },
      include: {
        reservations: {
          orderBy: { checkInDate: 'desc' },
          take: 10,
          include: { room: { select: { number: true, type: true } } },
        },
      },
    });
    if (!guest) return reply.status(404).send({ error: 'Hóspede não encontrado.' });
    return reply.send({ data: guest });
  });

  // POST /guests
  app.post('/guests', { preHandler: [authenticate, authorize('guests:write')] }, async (request, reply) => {
    const body = createGuestSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const exists = await prisma.guest.findUnique({ where: { cpfPassport: body.data.cpfPassport } });
    if (exists) return reply.status(409).send({ error: 'CPF/Passaporte já cadastrado.' });

    const guest = await prisma.guest.create({
      data: {
        ...body.data,
        email:     body.data.email     || null,
        birthDate: body.data.birthDate ? new Date(body.data.birthDate) : null,
      },
    });

    await recordAudit({ userId: request.user.sub, entityType: 'guest', entityId: guest.id, action: 'create', newValues: body.data, ipAddress: request.ip });
    return reply.status(201).send({ data: guest });
  });

  // PUT /guests/:id
  app.put('/guests/:id', { preHandler: [authenticate, authorize('guests:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateGuestSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const existing = await prisma.guest.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Hóspede não encontrado.' });

    const guest = await prisma.guest.update({
      where: { id },
      data: {
        ...body.data,
        email:     body.data.email     !== undefined ? (body.data.email || null) : undefined,
        birthDate: body.data.birthDate ? new Date(body.data.birthDate) : undefined,
      },
    });

    await recordAudit({ userId: request.user.sub, entityType: 'guest', entityId: id, action: 'update', oldValues: existing as Record<string, unknown>, newValues: body.data, ipAddress: request.ip });
    return reply.send({ data: guest });
  });

  // DELETE /guests/:id  (soft-delete via flag would be better; hard delete for MVP)
  app.delete('/guests/:id', { preHandler: [authenticate, authorize('guests:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.guest.findUnique({ where: { id }, include: { _count: { select: { reservations: true } } } });
    if (!existing) return reply.status(404).send({ error: 'Hóspede não encontrado.' });
    if (existing._count.reservations > 0) return reply.status(409).send({ error: 'Hóspede possui reservas e não pode ser excluído.' });

    await prisma.guest.delete({ where: { id } });
    await recordAudit({ userId: request.user.sub, entityType: 'guest', entityId: id, action: 'delete', oldValues: existing as Record<string, unknown>, ipAddress: request.ip });
    return reply.status(204).send();
  });
}
