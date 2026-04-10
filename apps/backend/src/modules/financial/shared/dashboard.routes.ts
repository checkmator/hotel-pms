import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/rbac';
import { getCashFlowProjection } from './cashflow.service';
import { getAgingReport } from './aging.service';

const prisma = new PrismaClient();

export async function financialDashboardRoutes(app: FastifyInstance) {
  // GET /financial/dashboard — KPIs + upcoming
  app.get('/financial/dashboard', { preHandler: [authenticate, authorize('financial:read')] }, async (_request, reply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);

    const [
      totalAPOpen,
      totalAROpen,
      overdueAP,
      overdueAR,
      upcomingAP,
      upcomingAR,
      cashFlow,
      aging,
    ] = await Promise.all([
      // Total AP in open statuses
      prisma.accountPayable.aggregate({
        where: { status: { in: ['PENDING', 'APPROVED', 'PARTIALLY_PAID', 'OVERDUE'] } },
        _sum: { totalAmount: true, paidAmount: true },
        _count: true,
      }),
      // Total AR in open statuses
      prisma.accountReceivable.aggregate({
        where: { status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
        _sum: { totalAmount: true, receivedAmount: true },
        _count: true,
      }),
      // Overdue AP
      prisma.accountPayable.aggregate({
        where: { status: 'OVERDUE' },
        _sum: { totalAmount: true, paidAmount: true },
        _count: true,
      }),
      // Overdue AR
      prisma.accountReceivable.aggregate({
        where: { status: 'OVERDUE' },
        _sum: { totalAmount: true, receivedAmount: true },
        _count: true,
      }),
      // AP due in next 30 days
      prisma.accountPayable.findMany({
        where: {
          dueDate: { gte: today, lte: in30Days },
          status: { in: ['PENDING', 'APPROVED', 'OVERDUE'] },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
        select: {
          id: true, code: true, description: true, dueDate: true, totalAmount: true, paidAmount: true, status: true,
          supplier: { select: { name: true } },
        },
      }),
      // AR due in next 30 days
      prisma.accountReceivable.findMany({
        where: {
          dueDate: { gte: today, lte: in30Days },
          status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
        select: {
          id: true, code: true, description: true, dueDate: true, totalAmount: true, receivedAmount: true, status: true,
          companyName: true, otaName: true,
        },
      }),
      getCashFlowProjection(30),
      getAgingReport(),
    ]);

    const apPending = Number(totalAPOpen._sum.totalAmount ?? 0) - Number(totalAPOpen._sum.paidAmount ?? 0);
    const arPending = Number(totalAROpen._sum.totalAmount ?? 0) - Number(totalAROpen._sum.receivedAmount ?? 0);
    const apOverdue = Number(overdueAP._sum.totalAmount ?? 0) - Number(overdueAP._sum.paidAmount ?? 0);
    const arOverdue = Number(overdueAR._sum.totalAmount ?? 0) - Number(overdueAR._sum.receivedAmount ?? 0);

    return reply.send({
      data: {
        kpis: {
          totalAPPending: Math.round(apPending * 100) / 100,
          totalAPCount: totalAPOpen._count,
          totalARPending: Math.round(arPending * 100) / 100,
          totalARCount: totalAROpen._count,
          overdueAP: Math.round(apOverdue * 100) / 100,
          overdueAPCount: overdueAP._count,
          overdueAR: Math.round(arOverdue * 100) / 100,
          overdueARCount: overdueAR._count,
          projectedBalance: Math.round((arPending - apPending) * 100) / 100,
        },
        upcomingAP,
        upcomingAR,
        cashFlow,
        aging,
      },
    });
  });

  // POST /financial/maintenance/update-overdue — mark overdue titles
  app.post('/financial/maintenance/update-overdue', { preHandler: [authenticate, authorize('financial:write')] }, async (_request, reply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [apResult, arResult] = await Promise.all([
      prisma.accountPayable.updateMany({
        where: { status: 'PENDING', dueDate: { lt: today } },
        data: { status: 'OVERDUE' },
      }),
      prisma.accountReceivable.updateMany({
        where: { status: 'PENDING', dueDate: { lt: today } },
        data: { status: 'OVERDUE' },
      }),
    ]);

    return reply.send({
      data: {
        message: 'Títulos vencidos atualizados.',
        apUpdated: apResult.count,
        arUpdated: arResult.count,
      },
    });
  });
}
