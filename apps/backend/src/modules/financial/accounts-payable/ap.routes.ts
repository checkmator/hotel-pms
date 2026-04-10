import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/rbac';
import { recordFinancialAudit } from '../shared/financial-audit';

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────

export async function generateAPCode(): Promise<string> {
  const count = await prisma.accountPayable.count();
  return `AP-${String(count + 1).padStart(5, '0')}`;
}

function computeStatus(totalAmount: number, paidAmount: number, dueDate: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (paidAmount >= totalAmount) return 'PAID';
  if (paidAmount > 0) return 'PARTIALLY_PAID';
  if (new Date(dueDate) < today) return 'OVERDUE';
  return 'PENDING';
}

// ── Schemas ───────────────────────────────────────────────────

const createAPSchema = z.object({
  supplierId: z.string().uuid(),
  categoryId: z.string().uuid(),
  costCenterId: z.string().uuid(),
  description: z.string().min(3).max(500),
  totalAmount: z.number().positive(),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  documentNumber: z.string().max(50).optional(),
  documentType: z.string().max(30).optional(),
  barcode: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  installments: z.object({
    count: z.number().int().min(2).max(60),
    intervalDays: z.number().int().min(1).default(30),
  }).optional(),
  taxRetentions: z.object({
    iss: z.number().min(0).optional(),
    irrf: z.number().min(0).optional(),
    pis: z.number().min(0).optional(),
    cofins: z.number().min(0).optional(),
    csll: z.number().min(0).optional(),
  }).optional(),
});

const payAPSchema = z.object({
  amount: z.number().positive(),
  paymentDate: z.string().date(),
  method: z.enum(['CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'BANK_SLIP', 'CHECK', 'VOUCHER', 'OTHER']),
  bankAccountId: z.string().uuid().optional(),
  transactionRef: z.string().max(100).optional(),
  installmentId: z.number().int().optional(),
  notes: z.string().max(500).optional(),
});

// ── Routes ────────────────────────────────────────────────────

export async function apRoutes(app: FastifyInstance) {

  // GET /financial/ap/aging
  app.get('/financial/ap/aging', { preHandler: [authenticate, authorize('financial:read')] }, async (_request, reply) => {
    const { getAgingReport } = await import('../shared/aging.service');
    const data = await getAgingReport();
    return reply.send({ data });
  });

  // GET /financial/ap/overdue
  app.get('/financial/ap/overdue', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const { page = '1', limit = '20' } = request.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [data, total] = await Promise.all([
      prisma.accountPayable.findMany({
        where: { status: 'OVERDUE' },
        skip, take: Number(limit),
        orderBy: { dueDate: 'asc' },
        include: { supplier: { select: { name: true } }, costCenter: { select: { name: true } }, category: { select: { name: true } } },
      }),
      prisma.accountPayable.count({ where: { status: 'OVERDUE' } }),
    ]);
    return reply.send({ data, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  // GET /financial/ap
  app.get('/financial/ap', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const {
      status, supplierId, costCenterId, categoryId,
      dueDateFrom, dueDateTo, page = '1', limit = '20', search = '',
    } = request.query as Record<string, string>;

    const skip = (Number(page) - 1) * Number(limit);
    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (costCenterId) where.costCenterId = costCenterId;
    if (categoryId) where.categoryId = categoryId;
    if (dueDateFrom || dueDateTo) {
      where.dueDate = {
        ...(dueDateFrom ? { gte: new Date(dueDateFrom) } : {}),
        ...(dueDateTo ? { lte: new Date(dueDateTo) } : {}),
      };
    }
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { documentNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.accountPayable.findMany({
        where, skip, take: Number(limit),
        orderBy: { dueDate: 'asc' },
        include: {
          supplier: { select: { id: true, name: true } },
          costCenter: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          _count: { select: { installments: true, payments: true } },
        },
      }),
      prisma.accountPayable.count({ where }),
    ]);

    return reply.send({ data, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  // GET /financial/ap/:id
  app.get('/financial/ap/:id', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ap = await prisma.accountPayable.findUnique({
      where: { id },
      include: {
        supplier: true,
        category: true,
        costCenter: true,
        recurrence: true,
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        installments: { orderBy: { installmentNumber: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' }, include: { bankAccount: { select: { bankName: true, accountNumber: true } } } },
        attachments: true,
        auditLogs: { orderBy: { performedAt: 'desc' }, take: 20 },
      },
    });
    if (!ap) return reply.status(404).send({ error: 'Título não encontrado.' });
    return reply.send({ data: ap });
  });

  // POST /financial/ap
  app.post('/financial/ap', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const body = createAPSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const code = await generateAPCode();
    const { installments, taxRetentions, ...rest } = body.data;

    const ap = await prisma.$transaction(async (tx) => {
      const created = await tx.accountPayable.create({
        data: {
          code,
          supplierId: rest.supplierId,
          categoryId: rest.categoryId,
          costCenterId: rest.costCenterId,
          description: rest.description,
          totalAmount: rest.totalAmount,
          issueDate: new Date(rest.issueDate),
          dueDate: new Date(rest.dueDate),
          documentNumber: rest.documentNumber,
          documentType: rest.documentType,
          barcode: rest.barcode,
          notes: rest.notes,
          issRetained: taxRetentions?.iss,
          irrfRetained: taxRetentions?.irrf,
          pisRetained: taxRetentions?.pis,
          cofinsRetained: taxRetentions?.cofins,
          csllRetained: taxRetentions?.csll,
          createdById: request.user.sub,
        },
      });

      // Generate installments if requested
      if (installments && installments.count > 1) {
        const installAmt = Math.floor((rest.totalAmount / installments.count) * 100) / 100;
        const lastAmt = Math.round((rest.totalAmount - installAmt * (installments.count - 1)) * 100) / 100;
        const baseDate = new Date(rest.dueDate);

        for (let i = 1; i <= installments.count; i++) {
          const due = new Date(baseDate);
          due.setDate(due.getDate() + (i - 1) * installments.intervalDays);
          await tx.installment.create({
            data: {
              installmentNumber: i,
              amount: i === installments.count ? lastAmt : installAmt,
              dueDate: due,
              payableId: created.id,
            },
          });
        }
      }

      return created;
    });

    await recordFinancialAudit({ action: 'CREATE', entityType: 'AP', entityId: ap.id, performedById: request.user.sub, ipAddress: request.ip, newValues: body.data });
    return reply.status(201).send({ data: ap });
  });

  // PUT /financial/ap/:id
  app.put('/financial/ap/:id', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.accountPayable.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Título não encontrado.' });
    if (!['PENDING', 'APPROVED'].includes(existing.status)) {
      return reply.status(409).send({ error: 'Título não pode ser editado no status atual.' });
    }

    const updateSchema = createAPSchema.omit({ installments: true }).partial();
    const body = updateSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const { taxRetentions, ...rest } = body.data;
    const ap = await prisma.accountPayable.update({
      where: { id },
      data: {
        ...rest,
        issueDate: rest.issueDate ? new Date(rest.issueDate) : undefined,
        dueDate: rest.dueDate ? new Date(rest.dueDate) : undefined,
        issRetained: taxRetentions?.iss,
        irrfRetained: taxRetentions?.irrf,
        pisRetained: taxRetentions?.pis,
        cofinsRetained: taxRetentions?.cofins,
        csllRetained: taxRetentions?.csll,
      },
    });

    await recordFinancialAudit({ action: 'UPDATE', entityType: 'AP', entityId: id, performedById: request.user.sub, ipAddress: request.ip, changes: body.data });
    return reply.send({ data: ap });
  });

  // DELETE /financial/ap/:id — soft delete
  app.delete('/financial/ap/:id', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.accountPayable.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Título não encontrado.' });
    if (existing.status === 'PAID') return reply.status(409).send({ error: 'Título já pago não pode ser cancelado.' });

    await prisma.accountPayable.update({ where: { id }, data: { status: 'CANCELLED' } });
    await recordFinancialAudit({ action: 'CANCEL', entityType: 'AP', entityId: id, performedById: request.user.sub, ipAddress: request.ip });
    return reply.send({ data: { message: 'Título cancelado.' } });
  });

  // POST /financial/ap/:id/approve
  app.post('/financial/ap/:id/approve', { preHandler: [authenticate, authorize('financial:approve')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ap = await prisma.accountPayable.findUnique({ where: { id } });
    if (!ap) return reply.status(404).send({ error: 'Título não encontrado.' });
    if (ap.approvalStatus !== 'PENDING') return reply.status(409).send({ error: 'Título já foi avaliado.' });

    const updated = await prisma.accountPayable.update({
      where: { id },
      data: { approvalStatus: 'APPROVED', approvedById: request.user.sub, approvedAt: new Date(), status: 'APPROVED' },
    });

    await recordFinancialAudit({ action: 'APPROVE', entityType: 'AP', entityId: id, performedById: request.user.sub, ipAddress: request.ip });
    return reply.send({ data: updated });
  });

  // POST /financial/ap/:id/reject
  app.post('/financial/ap/:id/reject', { preHandler: [authenticate, authorize('financial:approve')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ap = await prisma.accountPayable.findUnique({ where: { id } });
    if (!ap) return reply.status(404).send({ error: 'Título não encontrado.' });

    const updated = await prisma.accountPayable.update({
      where: { id },
      data: { approvalStatus: 'REJECTED', status: 'CANCELLED' },
    });

    await recordFinancialAudit({ action: 'REJECT', entityType: 'AP', entityId: id, performedById: request.user.sub, ipAddress: request.ip });
    return reply.send({ data: updated });
  });

  // POST /financial/ap/:id/pay
  app.post('/financial/ap/:id/pay', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = payAPSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const ap = await prisma.accountPayable.findUnique({ where: { id } });
    if (!ap) return reply.status(404).send({ error: 'Título não encontrado.' });
    if (!['PENDING', 'APPROVED', 'PARTIALLY_PAID', 'OVERDUE'].includes(ap.status)) {
      return reply.status(409).send({ error: 'Título não está em aberto para pagamento.' });
    }
    if (ap.approvalStatus === 'PENDING') {
      return reply.status(409).send({ error: 'Título precisa ser aprovado antes de pagar.' });
    }

    const newPaid = Number(ap.paidAmount) + body.data.amount;
    const newStatus = computeStatus(Number(ap.totalAmount), newPaid, ap.dueDate);

    await prisma.$transaction(async (tx) => {
      await tx.financialPayment.create({
        data: {
          amount: body.data.amount,
          paymentDate: new Date(body.data.paymentDate),
          method: body.data.method,
          bankAccountId: body.data.bankAccountId,
          transactionRef: body.data.transactionRef,
          installmentId: body.data.installmentId,
          notes: body.data.notes,
          payableId: id,
          createdById: request.user.sub,
        },
      });

      await tx.accountPayable.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          status: newStatus as 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERDUE',
          paymentDate: newStatus === 'PAID' ? new Date(body.data.paymentDate) : undefined,
        },
      });

      // Update installment if provided
      if (body.data.installmentId) {
        const inst = await tx.installment.findUnique({ where: { id: body.data.installmentId } });
        if (inst) {
          const instPaid = Number(inst.paidAmount) + body.data.amount;
          await tx.installment.update({
            where: { id: body.data.installmentId },
            data: { paidAmount: instPaid, status: instPaid >= Number(inst.amount) ? 'PAID' : 'PARTIALLY_PAID' },
          });
        }
      }
    });

    await recordFinancialAudit({ action: 'PAY', entityType: 'AP', entityId: id, performedById: request.user.sub, ipAddress: request.ip, changes: { amount: body.data.amount } });
    const updated = await prisma.accountPayable.findUnique({ where: { id } });
    return reply.send({ data: updated });
  });

  // POST /financial/ap/:id/cancel
  app.post('/financial/ap/:id/cancel', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ap = await prisma.accountPayable.findUnique({ where: { id } });
    if (!ap) return reply.status(404).send({ error: 'Título não encontrado.' });
    if (ap.status === 'PAID') return reply.status(409).send({ error: 'Título pago não pode ser cancelado.' });

    await prisma.accountPayable.update({ where: { id }, data: { status: 'CANCELLED' } });
    await recordFinancialAudit({ action: 'CANCEL', entityType: 'AP', entityId: id, performedById: request.user.sub, ipAddress: request.ip });
    return reply.send({ data: { message: 'Título cancelado.' } });
  });
}
