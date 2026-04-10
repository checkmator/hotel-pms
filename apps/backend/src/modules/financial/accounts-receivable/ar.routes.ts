import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/rbac';
import { recordFinancialAudit } from '../shared/financial-audit';

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────

async function generateARCode(): Promise<string> {
  const count = await prisma.accountReceivable.count();
  return `AR-${String(count + 1).padStart(5, '0')}`;
}

function computeARStatus(totalAmount: number, receivedAmount: number, dueDate: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (receivedAmount >= totalAmount) return 'PAID';
  if (receivedAmount > 0) return 'PARTIALLY_PAID';
  if (new Date(dueDate) < today) return 'OVERDUE';
  return 'PENDING';
}

// ── Schemas ───────────────────────────────────────────────────

const createARSchema = z.object({
  sourceType: z.enum(['RESERVATION', 'EVENT', 'RESTAURANT', 'OTA', 'AGENCY', 'CORPORATE', 'WALK_IN', 'OTHER']),
  categoryId: z.string().uuid(),
  costCenterId: z.string().uuid().optional(),
  description: z.string().min(3).max(500),
  totalAmount: z.number().positive(),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  documentNumber: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  // PMS references
  reservationId: z.string().uuid().optional(),
  guestId: z.string().uuid().optional(),
  companyName: z.string().max(150).optional(),
  // OTA fields
  otaName: z.string().max(60).optional(),
  otaBookingRef: z.string().max(60).optional(),
  otaCommissionRate: z.number().min(0).max(100).optional(),
  // City Ledger
  isCityLedger: z.boolean().optional(),
  cityLedgerRef: z.string().max(50).optional(),
  // Installments
  installments: z.object({
    count: z.number().int().min(2).max(60),
    intervalDays: z.number().int().min(1).default(30),
  }).optional(),
});

const receiveARSchema = z.object({
  amount: z.number().positive(),
  receiptDate: z.string().date(),
  method: z.enum(['CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'BANK_SLIP', 'CHECK', 'OTA_TRANSFER', 'VOUCHER', 'OTHER']),
  bankAccountId: z.string().uuid().optional(),
  transactionRef: z.string().max(100).optional(),
  installmentId: z.number().int().optional(),
  notes: z.string().max(500).optional(),
});

// ── Routes ────────────────────────────────────────────────────

export async function arRoutes(app: FastifyInstance) {

  // GET /financial/ar/overdue
  app.get('/financial/ar/overdue', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const { page = '1', limit = '20' } = request.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      prisma.accountReceivable.findMany({
        where: { status: 'OVERDUE' },
        skip, take: Number(limit),
        orderBy: { dueDate: 'asc' },
        include: {
          category: { select: { name: true } },
          costCenter: { select: { name: true } },
        },
      }),
      prisma.accountReceivable.count({ where: { status: 'OVERDUE' } }),
    ]);
    return reply.send({ data, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  // GET /financial/ar/city-ledger
  app.get('/financial/ar/city-ledger', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const { page = '1', limit = '20', companyName = '' } = request.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);
    const where: Record<string, unknown> = { isCityLedger: true, status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } };
    if (companyName) where.companyName = { contains: companyName, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.accountReceivable.findMany({
        where, skip, take: Number(limit),
        orderBy: { dueDate: 'asc' },
        include: { category: { select: { name: true } } },
      }),
      prisma.accountReceivable.count({ where }),
    ]);
    return reply.send({ data, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  // GET /financial/ar/ota-reconciliation
  app.get('/financial/ar/ota-reconciliation', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const { otaName, page = '1', limit = '20' } = request.query as Record<string, string>;
    const where: Record<string, unknown> = { sourceType: 'OTA' };
    if (otaName) where.otaName = { contains: otaName, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.accountReceivable.findMany({
        where, skip: (Number(page) - 1) * Number(limit), take: Number(limit),
        orderBy: { dueDate: 'desc' },
        select: {
          id: true, code: true, description: true, dueDate: true, status: true,
          totalAmount: true, receivedAmount: true,
          otaName: true, otaBookingRef: true, otaCommissionRate: true,
          otaCommissionAmt: true, otaNetAmount: true,
        },
      }),
      prisma.accountReceivable.count({ where }),
    ]);
    return reply.send({ data, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  // GET /financial/ar
  app.get('/financial/ar', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const {
      status, sourceType, categoryId, costCenterId,
      dueDateFrom, dueDateTo, page = '1', limit = '20', search = '',
    } = request.query as Record<string, string>;

    const skip = (Number(page) - 1) * Number(limit);
    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (sourceType) where.sourceType = sourceType;
    if (categoryId) where.categoryId = categoryId;
    if (costCenterId) where.costCenterId = costCenterId;
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
        { companyName: { contains: search, mode: 'insensitive' } },
        { otaBookingRef: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.accountReceivable.findMany({
        where, skip, take: Number(limit),
        orderBy: { dueDate: 'asc' },
        include: {
          category: { select: { id: true, name: true } },
          costCenter: { select: { id: true, name: true } },
          _count: { select: { installments: true, payments: true } },
        },
      }),
      prisma.accountReceivable.count({ where }),
    ]);

    return reply.send({ data, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  // GET /financial/ar/:id
  app.get('/financial/ar/:id', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ar = await prisma.accountReceivable.findUnique({
      where: { id },
      include: {
        category: true,
        costCenter: true,
        createdBy: { select: { id: true, name: true } },
        installments: { orderBy: { installmentNumber: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' }, include: { bankAccount: { select: { bankName: true, accountNumber: true } } } },
        attachments: true,
        auditLogs: { orderBy: { performedAt: 'desc' }, take: 20 },
      },
    });
    if (!ar) return reply.status(404).send({ error: 'Título não encontrado.' });
    return reply.send({ data: ar });
  });

  // POST /financial/ar
  app.post('/financial/ar', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const body = createARSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const code = await generateARCode();
    const { installments, ...rest } = body.data;

    // Auto-calculate OTA net amount
    let otaCommissionAmt: number | undefined;
    let otaNetAmount: number | undefined;
    if (rest.sourceType === 'OTA' && rest.otaCommissionRate) {
      otaCommissionAmt = Math.round(rest.totalAmount * (rest.otaCommissionRate / 100) * 100) / 100;
      otaNetAmount = Math.round((rest.totalAmount - otaCommissionAmt) * 100) / 100;
    }

    const ar = await prisma.$transaction(async (tx) => {
      const created = await tx.accountReceivable.create({
        data: {
          code,
          sourceType: rest.sourceType,
          categoryId: rest.categoryId,
          costCenterId: rest.costCenterId,
          description: rest.description,
          totalAmount: rest.totalAmount,
          issueDate: new Date(rest.issueDate),
          dueDate: new Date(rest.dueDate),
          documentNumber: rest.documentNumber,
          notes: rest.notes,
          reservationId: rest.reservationId,
          guestId: rest.guestId,
          companyName: rest.companyName,
          otaName: rest.otaName,
          otaBookingRef: rest.otaBookingRef,
          otaCommissionRate: rest.otaCommissionRate,
          otaCommissionAmt,
          otaNetAmount,
          isCityLedger: rest.isCityLedger ?? false,
          cityLedgerRef: rest.cityLedgerRef,
          createdById: request.user.sub,
        },
      });

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
              receivableId: created.id,
            },
          });
        }
      }

      return created;
    });

    await recordFinancialAudit({ action: 'CREATE', entityType: 'AR', entityId: ar.id, performedById: request.user.sub, ipAddress: request.ip, newValues: body.data });
    return reply.status(201).send({ data: ar });
  });

  // PUT /financial/ar/:id
  app.put('/financial/ar/:id', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.accountReceivable.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Título não encontrado.' });
    if (!['PENDING'].includes(existing.status)) {
      return reply.status(409).send({ error: 'Título não pode ser editado no status atual.' });
    }

    const updateSchema = createARSchema.omit({ installments: true }).partial();
    const body = updateSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    // Recalculate OTA if rate changed
    let otaCommissionAmt = body.data.otaCommissionRate !== undefined && body.data.totalAmount !== undefined
      ? Math.round((body.data.totalAmount) * ((body.data.otaCommissionRate) / 100) * 100) / 100
      : undefined;
    let otaNetAmount = otaCommissionAmt !== undefined && body.data.totalAmount !== undefined
      ? Math.round((body.data.totalAmount - otaCommissionAmt) * 100) / 100
      : undefined;

    const ar = await prisma.accountReceivable.update({
      where: { id },
      data: {
        ...body.data,
        issueDate: body.data.issueDate ? new Date(body.data.issueDate) : undefined,
        dueDate: body.data.dueDate ? new Date(body.data.dueDate) : undefined,
        otaCommissionAmt,
        otaNetAmount,
      },
    });

    await recordFinancialAudit({ action: 'UPDATE', entityType: 'AR', entityId: id, performedById: request.user.sub, ipAddress: request.ip, changes: body.data });
    return reply.send({ data: ar });
  });

  // DELETE /financial/ar/:id — soft delete
  app.delete('/financial/ar/:id', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.accountReceivable.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Título não encontrado.' });
    if (existing.status === 'PAID') return reply.status(409).send({ error: 'Título já recebido não pode ser cancelado.' });

    await prisma.accountReceivable.update({ where: { id }, data: { status: 'CANCELLED' } });
    await recordFinancialAudit({ action: 'CANCEL', entityType: 'AR', entityId: id, performedById: request.user.sub, ipAddress: request.ip });
    return reply.send({ data: { message: 'Título cancelado.' } });
  });

  // POST /financial/ar/:id/receive
  app.post('/financial/ar/:id/receive', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = receiveARSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const ar = await prisma.accountReceivable.findUnique({ where: { id } });
    if (!ar) return reply.status(404).send({ error: 'Título não encontrado.' });
    if (!['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(ar.status)) {
      return reply.status(409).send({ error: 'Título não está em aberto para recebimento.' });
    }

    const newReceived = Number(ar.receivedAmount) + body.data.amount;
    const newStatus = computeARStatus(Number(ar.totalAmount), newReceived, ar.dueDate);

    await prisma.$transaction(async (tx) => {
      await tx.financialPayment.create({
        data: {
          amount: body.data.amount,
          paymentDate: new Date(body.data.receiptDate),
          method: body.data.method,
          bankAccountId: body.data.bankAccountId,
          transactionRef: body.data.transactionRef,
          installmentId: body.data.installmentId,
          notes: body.data.notes,
          receivableId: id,
          createdById: request.user.sub,
        },
      });

      await tx.accountReceivable.update({
        where: { id },
        data: {
          receivedAmount: newReceived,
          status: newStatus as 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERDUE',
          receiptDate: newStatus === 'PAID' ? new Date(body.data.receiptDate) : undefined,
        },
      });

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

    await recordFinancialAudit({ action: 'RECEIVE', entityType: 'AR', entityId: id, performedById: request.user.sub, ipAddress: request.ip, changes: { amount: body.data.amount } });
    const updated = await prisma.accountReceivable.findUnique({ where: { id } });
    return reply.send({ data: updated });
  });

  // POST /financial/ar/:id/split — split into corporate city-ledger portion
  app.post('/financial/ar/:id/split', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      corporateAmount: z.number().positive(),
      companyName: z.string().min(2).max(150),
      cityLedgerRef: z.string().max(50).optional(),
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const ar = await prisma.accountReceivable.findUnique({ where: { id } });
    if (!ar) return reply.status(404).send({ error: 'Título não encontrado.' });
    if (body.data.corporateAmount >= Number(ar.totalAmount)) {
      return reply.status(409).send({ error: 'Valor corporativo deve ser menor que o total.' });
    }

    const remainingAmount = Number(ar.totalAmount) - body.data.corporateAmount;
    const code = await generateARCode();

    const [updatedOriginal, corporatePortion] = await prisma.$transaction([
      prisma.accountReceivable.update({
        where: { id },
        data: { totalAmount: remainingAmount },
      }),
      prisma.accountReceivable.create({
        data: {
          code,
          sourceType: ar.sourceType,
          categoryId: ar.categoryId,
          costCenterId: ar.costCenterId ?? undefined,
          description: `${ar.description} (Corporativo)`,
          totalAmount: body.data.corporateAmount,
          issueDate: ar.issueDate,
          dueDate: ar.dueDate,
          isCityLedger: true,
          companyName: body.data.companyName,
          cityLedgerRef: body.data.cityLedgerRef,
          createdById: request.user.sub,
        },
      }),
    ]);

    return reply.status(201).send({ data: { original: updatedOriginal, corporate: corporatePortion } });
  });
}
