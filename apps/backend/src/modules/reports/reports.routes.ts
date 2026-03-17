import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/rbac';

const prisma = new PrismaClient();

export async function reportRoutes(app: FastifyInstance) {

  // GET /reports/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get('/reports/revenue', { preHandler: [authenticate, authorize('reports:read')] }, async (request, reply) => {
    const { from, to } = request.query as { from?: string; to?: string };

    const dateFilter = buildDateFilter(from, to);

    // ── Closed invoices in period ──────────────────────────────
    const invoices = await prisma.invoice.findMany({
      where: {
        status: 'closed',
        closedAt: dateFilter,
      },
      select: {
        subtotal: true,
        taxes: true,
        discounts: true,
        total: true,
        closedAt: true,
      },
    });

    const totals = invoices.reduce(
      (acc, inv) => ({
        subtotal:  acc.subtotal  + Number(inv.subtotal),
        taxes:     acc.taxes     + Number(inv.taxes),
        discounts: acc.discounts + Number(inv.discounts),
        total:     acc.total     + Number(inv.total),
        count:     acc.count     + 1,
      }),
      { subtotal: 0, taxes: 0, discounts: 0, total: 0, count: 0 },
    );

    // ── Revenue grouped by day ─────────────────────────────────
    const byDay: Record<string, number> = {};
    for (const inv of invoices) {
      if (!inv.closedAt) continue;
      const day = inv.closedAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + Number(inv.total);
    }
    const dailySeries = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue: round2(revenue) }));

    // ── Revenue by transaction category ───────────────────────
    const txCats = await prisma.transaction.groupBy({
      by: ['category'],
      where: {
        status: 'paid',
        transactionDate: dateFilter,
      },
      _sum: { amount: true },
      _count: true,
    });
    const byCategory = txCats.map((r) => ({
      category: r.category,
      total: round2(Number(r._sum.amount ?? 0)),
      count: r._count,
    })).sort((a, b) => b.total - a.total);

    // ── Reservations summary ───────────────────────────────────
    const [checkedOut, cancelled] = await Promise.all([
      prisma.reservation.count({ where: { status: 'checked_out', actualCheckOut: dateFilter } }),
      prisma.reservation.count({ where: { status: 'cancelled', updatedAt: dateFilter } }),
    ]);

    return reply.send({
      data: {
        period: { from: from ?? null, to: to ?? null },
        summary: {
          invoicesCount: totals.count,
          subtotal:  round2(totals.subtotal),
          taxes:     round2(totals.taxes),
          discounts: round2(totals.discounts),
          total:     round2(totals.total),
          checkedOutReservations: checkedOut,
          cancelledReservations:  cancelled,
        },
        dailySeries,
        byCategory,
      },
    });
  });

  // GET /reports/revenue-monthly?months=12
  app.get('/reports/revenue-monthly', { preHandler: [authenticate, authorize('reports:read')] }, async (request, reply) => {
    const { months = '12' } = request.query as { months?: string };
    const count = Math.min(parseInt(months) || 12, 24);
    const now = new Date();

    const results = await Promise.all(
      Array.from({ length: count }, (_, i) => {
        const start = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
        const end   = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i) + 1, 0, 23, 59, 59, 999);
        return prisma.invoice.aggregate({
          where: { status: 'closed', closedAt: { gte: start, lte: end } },
          _sum: { total: true },
          _count: true,
        }).then((agg) => ({
          month: start.toISOString().slice(0, 7),
          label: start.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          total: round2(Number(agg._sum.total ?? 0)),
          count: agg._count,
        }));
      }),
    );

    return reply.send({ data: results });
  });

  // GET /reports/occupancy?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get('/reports/occupancy', { preHandler: [authenticate, authorize('reports:read')] }, async (request, reply) => {
    const { from, to } = request.query as { from?: string; to?: string };

    const start = from ? new Date(from) : subDays(new Date(), 29);
    const end   = to   ? new Date(to)   : new Date();

    const [totalRooms, reservations] = await Promise.all([
      prisma.room.count(),
      prisma.reservation.findMany({
        where: {
          status: { in: ['confirmed', 'checked_in', 'checked_out'] },
          checkInDate:  { lte: end },
          checkOutDate: { gte: start },
        },
        select: { checkInDate: true, checkOutDate: true },
      }),
    ]);

    // Build daily occupancy map
    const days = eachDayBetween(start, end);
    const series = days.map((day) => {
      const occupied = reservations.filter((r) => {
        return r.checkInDate <= day && r.checkOutDate > day;
      }).length;
      return {
        date: day.toISOString().slice(0, 10),
        occupied,
        total: totalRooms,
        rate: totalRooms > 0 ? round2((occupied / totalRooms) * 100) : 0,
      };
    });

    const avgRate = series.length
      ? round2(series.reduce((s, d) => s + d.rate, 0) / series.length)
      : 0;

    return reply.send({
      data: {
        period: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
        totalRooms,
        avgOccupancyRate: avgRate,
        dailySeries: series,
      },
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDateFilter(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(to + 'T23:59:59.999Z') } : {}),
  };
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function eachDayBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (current <= last) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
