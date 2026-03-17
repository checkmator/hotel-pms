import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/rbac';
import { recordAudit } from '../../services/audit.service';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

const createSchema = z.object({
  name:     z.string().min(2).max(120),
  email:    z.string().email(),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres.'),
  role:     z.enum(['admin', 'reception', 'housekeeping']),
});

const updateSchema = z.object({
  name:     z.string().min(2).max(120).optional(),
  email:    z.string().email().optional(),
  password: z.string().min(8).optional(),
  role:     z.enum(['admin', 'reception', 'housekeeping']).optional(),
  active:   z.boolean().optional(),
});

export async function userRoutes(app: FastifyInstance) {

  // GET /users
  app.get('/users', { preHandler: [authenticate, authorize('users:manage')] }, async (request, reply) => {
    const { page = '1', limit = '20', search = '' } = request.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where = search
      ? {
          OR: [
            { name:  { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, email: true,
          role: true, active: true,
          createdAt: true, updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return reply.send({ data: users, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  // GET /users/:id
  app.get('/users/:id', { preHandler: [authenticate, authorize('users:manage')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, updatedAt: true },
    });
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado.' });
    return reply.send({ data: user });
  });

  // POST /users
  app.post('/users', { preHandler: [authenticate, authorize('users:manage')] }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const existing = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (existing) return reply.status(409).send({ error: 'E-mail já cadastrado.' });

    const passwordHash = await bcrypt.hash(body.data.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name:         body.data.name,
        email:        body.data.email,
        passwordHash,
        role:         body.data.role,
      },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });

    await recordAudit({
      userId: request.user.sub,
      entityType: 'user', entityId: user.id,
      action: 'create',
      newValues: { name: body.data.name, email: body.data.email, role: body.data.role },
      ipAddress: request.ip,
    });

    return reply.status(201).send({ data: user });
  });

  // PATCH /users/:id
  app.patch('/users/:id', { preHandler: [authenticate, authorize('users:manage')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Usuário não encontrado.' });

    // Prevent admin from deactivating themselves
    if (id === request.user.sub && body.data.active === false) {
      return reply.status(409).send({ error: 'Você não pode desativar sua própria conta.' });
    }

    // Check e-mail uniqueness if changed
    if (body.data.email && body.data.email !== existing.email) {
      const conflict = await prisma.user.findUnique({ where: { email: body.data.email } });
      if (conflict) return reply.status(409).send({ error: 'E-mail já em uso.' });
    }

    const updateData: Record<string, unknown> = {};
    if (body.data.name   !== undefined) updateData.name   = body.data.name;
    if (body.data.email  !== undefined) updateData.email  = body.data.email;
    if (body.data.role   !== undefined) updateData.role   = body.data.role;
    if (body.data.active !== undefined) updateData.active = body.data.active;
    if (body.data.password) {
      updateData.passwordHash = await bcrypt.hash(body.data.password, SALT_ROUNDS);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, active: true, updatedAt: true },
    });

    await recordAudit({
      userId: request.user.sub,
      entityType: 'user', entityId: id,
      action: 'update',
      oldValues: { name: existing.name, email: existing.email, role: existing.role, active: existing.active } as Record<string, unknown>,
      newValues: body.data as Record<string, unknown>,
      ipAddress: request.ip,
    });

    return reply.send({ data: user });
  });

  // DELETE /users/:id — soft-delete (deactivate)
  app.delete('/users/:id', { preHandler: [authenticate, authorize('users:manage')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (id === request.user.sub) {
      return reply.status(409).send({ error: 'Você não pode excluir sua própria conta.' });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Usuário não encontrado.' });

    await prisma.user.update({ where: { id }, data: { active: false } });

    await recordAudit({
      userId: request.user.sub,
      entityType: 'user', entityId: id,
      action: 'delete',
      oldValues: { active: existing.active } as Record<string, unknown>,
      newValues: { active: false },
      ipAddress: request.ip,
    });

    return reply.status(204).send();
  });
}
