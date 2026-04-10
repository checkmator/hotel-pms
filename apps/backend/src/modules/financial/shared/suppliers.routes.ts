import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/rbac';

const prisma = new PrismaClient();

const supplierSchema = z.object({
  name: z.string().min(2).max(150),
  tradeName: z.string().max(150).optional(),
  document: z.string().min(11).max(20),
  documentType: z.enum(['CNPJ', 'CPF']),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(2).optional(),
  zipCode: z.string().max(10).optional(),
  bankName: z.string().max(60).optional(),
  bankBranch: z.string().max(10).optional(),
  bankAccount: z.string().max(20).optional(),
  pixKey: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export async function supplierRoutes(app: FastifyInstance) {
  app.get('/financial/suppliers', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const { search = '', page = '1', limit = '50', active } = request.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);
    const where: Record<string, unknown> = {};
    if (active !== undefined) where.isActive = active === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { document: { contains: search } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.supplier.findMany({ where, skip, take: Number(limit), orderBy: { name: 'asc' } }),
      prisma.supplier.count({ where }),
    ]);
    return reply.send({ data, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  app.get('/financial/suppliers/:id', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { payables: true } } },
    });
    if (!supplier) return reply.status(404).send({ error: 'Fornecedor não encontrado.' });
    return reply.send({ data: supplier });
  });

  app.post('/financial/suppliers', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const body = supplierSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });
    const exists = await prisma.supplier.findUnique({ where: { document: body.data.document } });
    if (exists) return reply.status(409).send({ error: 'Documento já cadastrado.' });
    const supplier = await prisma.supplier.create({ data: body.data });
    return reply.status(201).send({ data: supplier });
  });

  app.put('/financial/suppliers/:id', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = supplierSchema.partial().safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Fornecedor não encontrado.' });
    const supplier = await prisma.supplier.update({ where: { id }, data: body.data });
    return reply.send({ data: supplier });
  });

  app.delete('/financial/suppliers/:id', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { payables: true } } },
    });
    if (!existing) return reply.status(404).send({ error: 'Fornecedor não encontrado.' });
    if (existing._count.payables > 0) {
      await prisma.supplier.update({ where: { id }, data: { isActive: false } });
      return reply.send({ data: { message: 'Fornecedor desativado (possui títulos vinculados).' } });
    }
    await prisma.supplier.delete({ where: { id } });
    return reply.status(204).send();
  });
}
