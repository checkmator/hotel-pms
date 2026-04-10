import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/rbac';

const prisma = new PrismaClient();

const costCenterSchema = z.object({
  name: z.string().min(2).max(80),
  code: z.string().min(2).max(20),
  isActive: z.boolean().optional(),
});

const expenseCategorySchema = z.object({
  name: z.string().min(2).max(80),
  parentId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

const revenueCategorySchema = z.object({
  name: z.string().min(2).max(80),
  isActive: z.boolean().optional(),
});

export async function costCenterRoutes(app: FastifyInstance) {
  // ── Cost Centers ────────────────────────────────────────────
  app.get('/financial/cost-centers', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const data = await prisma.costCenter.findMany({ orderBy: { name: 'asc' } });
    return reply.send({ data });
  });

  app.post('/financial/cost-centers', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const body = costCenterSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });
    const cc = await prisma.costCenter.create({ data: body.data });
    return reply.status(201).send({ data: cc });
  });

  app.put('/financial/cost-centers/:id', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = costCenterSchema.partial().safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });
    const cc = await prisma.costCenter.update({ where: { id }, data: body.data });
    return reply.send({ data: cc });
  });

  // ── Expense Categories ──────────────────────────────────────
  app.get('/financial/categories/expense', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const data = await prisma.expenseCategory.findMany({
      where: { isActive: true },
      include: { children: { where: { isActive: true } } },
      orderBy: { name: 'asc' },
    });
    return reply.send({ data });
  });

  app.post('/financial/categories/expense', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const body = expenseCategorySchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });
    const cat = await prisma.expenseCategory.create({ data: body.data });
    return reply.status(201).send({ data: cat });
  });

  // ── Revenue Categories ──────────────────────────────────────
  app.get('/financial/categories/revenue', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const data = await prisma.revenueCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return reply.send({ data });
  });

  app.post('/financial/categories/revenue', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const body = revenueCategorySchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });
    const cat = await prisma.revenueCategory.create({ data: body.data });
    return reply.status(201).send({ data: cat });
  });

  // ── Bank Accounts ───────────────────────────────────────────
  app.get('/financial/bank-accounts', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const data = await prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { bankName: 'asc' } });
    return reply.send({ data });
  });

  app.post('/financial/bank-accounts', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const schema = z.object({
      bankName: z.string().min(2).max(80),
      branch: z.string().min(1).max(10),
      accountNumber: z.string().min(1).max(20),
      accountType: z.enum(['corrente', 'poupança', 'pagamento']),
      balance: z.number().optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });
    const account = await prisma.bankAccount.create({ data: body.data });
    return reply.status(201).send({ data: account });
  });
}
