import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/rbac';

const prisma = new PrismaClient();

// ── OFX parser (basic regex — no external lib) ────────────────

interface OFXTransaction {
  type: 'CREDIT' | 'DEBIT' | 'OTHER';
  amount: number;
  date: string; // YYYYMMDD
  memo: string;
  fitid: string;
}

function parseOFX(ofxText: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = [];
  const stmttrn = ofxText.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/g) ?? [];

  for (const block of stmttrn) {
    const trntype = block.match(/<TRNTYPE>([^<]+)/)?.[1]?.trim() ?? 'OTHER';
    const dtposted = block.match(/<DTPOSTED>([0-9]{8})/)?.[1] ?? '';
    const trnamt = block.match(/<TRNAMT>([^<]+)/)?.[1]?.trim() ?? '0';
    const memo = block.match(/<MEMO>([^<]+)/)?.[1]?.trim() ?? '';
    const fitid = block.match(/<FITID>([^<]+)/)?.[1]?.trim() ?? '';

    const amount = Math.abs(parseFloat(trnamt.replace(',', '.')));
    const type: OFXTransaction['type'] =
      trntype === 'CREDIT' ? 'CREDIT' :
      trntype === 'DEBIT' ? 'DEBIT' : 'OTHER';

    if (dtposted && amount > 0) {
      transactions.push({ type, amount, date: dtposted, memo, fitid });
    }
  }

  return transactions;
}

function ofxDateToISO(ofxDate: string): string {
  // YYYYMMDD → YYYY-MM-DD
  return `${ofxDate.slice(0, 4)}-${ofxDate.slice(4, 6)}-${ofxDate.slice(6, 8)}`;
}

// In-memory store for reconciliation session (production would use DB table)
// We store unmatched OFX transactions in a simple bank_account meta field approach
// For simplicity we return them per-call and let the frontend hold state

export async function reconciliationRoutes(app: FastifyInstance) {
  // POST /financial/bank-reconciliation/import
  // Accepts { ofxContent: string, bankAccountId: string }
  app.post('/financial/bank-reconciliation/import', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const body = z.object({
      ofxContent: z.string().min(10),
      bankAccountId: z.string().uuid(),
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const account = await prisma.bankAccount.findUnique({ where: { id: body.data.bankAccountId } });
    if (!account) return reply.status(404).send({ error: 'Conta bancária não encontrada.' });

    const parsed = parseOFX(body.data.ofxContent);

    // Cross-reference with existing reconciled transactions to skip duplicates
    const fitids = parsed.map((t) => t.fitid).filter(Boolean);
    const existing = await prisma.financialPayment.findMany({
      where: { transactionRef: { in: fitids }, bankAccountId: body.data.bankAccountId },
      select: { transactionRef: true },
    });
    const reconciledFitids = new Set(existing.map((e) => e.transactionRef));

    const unmatched = parsed
      .filter((t) => !reconciledFitids.has(t.fitid))
      .map((t) => ({
        fitid: t.fitid,
        type: t.type,
        amount: t.amount,
        date: ofxDateToISO(t.date),
        memo: t.memo,
      }));

    return reply.send({
      data: {
        total: parsed.length,
        alreadyReconciled: parsed.length - unmatched.length,
        unmatched,
        bankAccount: { id: account.id, bankName: account.bankName, accountNumber: account.accountNumber },
      },
    });
  });

  // GET /financial/bank-reconciliation/pending
  // Returns unreconciled payments (already in DB but not yet linked to OFX entry)
  app.get('/financial/bank-reconciliation/pending', { preHandler: [authenticate, authorize('financial:read')] }, async (request, reply) => {
    const { bankAccountId, page = '1', limit = '20' } = request.query as Record<string, string>;
    const where: Record<string, unknown> = { isReconciled: false };
    if (bankAccountId) where.bankAccountId = bankAccountId;

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      prisma.financialPayment.findMany({
        where, skip, take: Number(limit),
        orderBy: { paymentDate: 'desc' },
        include: {
          bankAccount: { select: { bankName: true, accountNumber: true } },
          payable: { select: { code: true, description: true } },
          receivable: { select: { code: true, description: true } },
        },
      }),
      prisma.financialPayment.count({ where }),
    ]);

    return reply.send({ data, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  // POST /financial/bank-reconciliation/match
  // Links an OFX transaction (fitid) to an existing FinancialPayment
  app.post('/financial/bank-reconciliation/match', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const body = z.object({
      paymentId: z.string().uuid(),
      fitid: z.string().min(1),
      bankAccountId: z.string().uuid(),
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    const payment = await prisma.financialPayment.findUnique({ where: { id: body.data.paymentId } });
    if (!payment) return reply.status(404).send({ error: 'Pagamento não encontrado.' });

    const updated = await prisma.financialPayment.update({
      where: { id: body.data.paymentId },
      data: {
        isReconciled: true,
        reconciledAt: new Date(),
        transactionRef: body.data.fitid,
        bankAccountId: body.data.bankAccountId,
      },
    });

    return reply.send({ data: updated });
  });

  // POST /financial/bank-reconciliation/unmatch
  app.post('/financial/bank-reconciliation/unmatch', { preHandler: [authenticate, authorize('financial:write')] }, async (request, reply) => {
    const body = z.object({ paymentId: z.string().uuid() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.' });

    const updated = await prisma.financialPayment.update({
      where: { id: body.data.paymentId },
      data: { isReconciled: false, reconciledAt: null },
    });
    return reply.send({ data: updated });
  });
}
