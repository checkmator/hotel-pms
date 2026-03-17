import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/rbac';

const prisma = new PrismaClient();

export async function auditRoutes(app: FastifyInstance) {

  // GET /audit-logs?entityType=&action=&userId=&from=&to=&page=&limit=
  app.get('/audit-logs', { preHandler: [authenticate, authorize('audit_logs:read')] }, async (request, reply) => {
    const {
      entityType,
      action,
      userId,
      from,
      to,
      page  = '1',
      limit = '50',
    } = request.query as Record<string, string>;

    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (action)     where.action     = action;
    if (userId)     where.userId     = userId;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) }               : {}),
        ...(to   ? { lte: new Date(to + 'T23:59:59.999Z') } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return reply.send({
      data: logs,
      meta: { total, page: Number(page), limit: Number(limit) },
    });
  });
}
