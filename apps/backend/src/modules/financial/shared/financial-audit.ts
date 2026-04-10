import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditOpts {
  action: string;
  entityType: 'AP' | 'AR';
  entityId: string;
  performedById: string;
  ipAddress?: string;
  newValues?: unknown;
  changes?: unknown;
}

export async function recordFinancialAudit(opts: AuditOpts): Promise<void> {
  try {
    await prisma.financialAuditLog.create({
      data: {
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        changes: (opts.newValues ?? opts.changes ?? {}) as object,
        performedById: opts.performedById,
        ipAddress: opts.ipAddress,
        payableId: opts.entityType === 'AP' ? opts.entityId : undefined,
        receivableId: opts.entityType === 'AR' ? opts.entityId : undefined,
      },
    });
  } catch {
    // fire-and-forget — audit must never break business flow
  }
}
