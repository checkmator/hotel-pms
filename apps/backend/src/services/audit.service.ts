import { PrismaClient, AuditAction } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditOptions {
  userId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Persists an immutable audit record.
 * Fire-and-forget: errors are logged but never propagate to the caller,
 * preventing audit failures from breaking business transactions.
 */
export async function recordAudit(opts: AuditOptions): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId,
        entityType: opts.entityType,
        entityId: opts.entityId,
        action: opts.action,
        oldValues: opts.oldValues ? (opts.oldValues as object) : undefined,
        newValues: opts.newValues ? (opts.newValues as object) : undefined,
        ipAddress: opts.ipAddress,
      },
    });
  } catch (err) {
    // Audit failures must NEVER break business flow — log only
    console.error('[AuditService] Failed to write audit log:', err);
  }
}
