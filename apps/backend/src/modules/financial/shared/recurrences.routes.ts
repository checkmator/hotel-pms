import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/rbac';
import { generateRecurringPayables } from './recurrence.service';

const prisma = new PrismaClient();

const recurrenceSchema = z.object({
  description: z.string().min(3).max(200),
  frequency: z.enum(['MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']),
  startDate: z.string().date(),
  endDate: z.string().date().optional(),
  nextDueDate: z.string().date(),
  templateAmount: z.number().positive(),
  isActive: z.boolean().optional(),
});

export async function recurrenceRoutes(app: FastifyInstance) {
  // GET /financial/recurrences
  app.get('/financial/recurrences', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const { isActive } = request.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const data = await prisma.recurrence.findMany({
      where,
      orderBy: { nextDueDate: 'asc' },
      include: { _count: { select: { payables: true } } },
    });
    return reply.send({ data });
  });

  // POST /financial/recurrences
  app.post('/financial/recurrences', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const body = recurrenceSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const rec = await prisma.recurrence.create({
      data: {
        ...body.data,
        startDate: new Date(body.data.startDate),
        endDate: body.data.endDate ? new Date(body.data.endDate) : undefined,
        nextDueDate: new Date(body.data.nextDueDate),
      },
    });
    return reply.status(201).send({ data: rec });
  });

  // PUT /financial/recurrences/:id
  app.put('/financial/recurrences/:id', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = recurrenceSchema.partial().safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const rec = await prisma.recurrence.update({
      where: { id },
      data: {
        ...body.data,
        startDate: body.data.startDate ? new Date(body.data.startDate) : undefined,
        endDate: body.data.endDate ? new Date(body.data.endDate) : undefined,
        nextDueDate: body.data.nextDueDate ? new Date(body.data.nextDueDate) : undefined,
      },
    });
    return reply.send({ data: rec });
  });

  // DELETE /financial/recurrences/:id — deactivate
  app.delete('/financial/recurrences/:id', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.recurrence.update({ where: { id }, data: { isActive: false } });
    return reply.send({ data: { message: 'Recorrência desativada.' } });
  });

  // POST /financial/recurrences/generate — trigger generation manually
  app.post('/financial/recurrences/generate', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const generated = await generateRecurringPayables(request.user.sub);
    return reply.send({ data: { generated, message: `${generated} título(s) gerado(s).` } });
  });
}
