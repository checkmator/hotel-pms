import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';

const prisma = new PrismaClient();

export async function dashboardRoutes(app: FastifyInstance) {

  // GET /dashboard — snapshot for the home KPI cards
  app.get('/dashboard', { preHandler: [authenticate] }, async (_request, reply) => {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      // Today's operations
      checkInsToday,
      checkOutsToday,
      pendingCheckIns,

      // Room snapshot
      roomsByStatus,
      totalRooms,

      // Revenue this month
      monthRevenue,

      // Upcoming check-ins (next 7 days)
      upcomingCheckIns,

      // Recent reservations
      recentReservations,
    ] = await Promise.all([
      // Check-ins done today
      prisma.reservation.count({
        where: { status: 'checked_in', actualCheckIn: { gte: today, lt: tomorrow } },
      }),

      // Check-outs done today
      prisma.reservation.count({
        where: { status: 'checked_out', actualCheckOut: { gte: today, lt: tomorrow } },
      }),

      // Confirmed reservations with check-in date = today (not yet checked in)
      prisma.reservation.count({
        where: {
          status: { in: ['confirmed', 'pending'] },
          checkInDate: { gte: today, lt: tomorrow },
        },
      }),

      // Room counts by status
      prisma.room.groupBy({ by: ['status'], _count: true }),

      // Total rooms
      prisma.room.count(),

      // Revenue this month (closed invoices)
      prisma.invoice.aggregate({
        where: { status: 'closed', closedAt: { gte: monthStart } },
        _sum: { total: true },
        _count: true,
      }),

      // Upcoming check-ins next 7 days
      prisma.reservation.findMany({
        where: {
          status: { in: ['confirmed', 'pending'] },
          checkInDate: {
            gte: tomorrow,
            lt: new Date(today.getTime() + 7 * 86_400_000),
          },
        },
        take: 5,
        orderBy: { checkInDate: 'asc' },
        include: {
          guest: { select: { fullName: true, cpfPassport: true } },
          room:  { select: { number: true, type: true } },
        },
      }),

      // Recent 5 reservations created
      prisma.reservation.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          guest: { select: { fullName: true } },
          room:  { select: { number: true } },
        },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of roomsByStatus) statusMap[s.status] = s._count;

    const occupiedCount = statusMap['occupied'] ?? 0;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;

    return reply.send({
      data: {
        today: {
          checkInsCompleted:  checkInsToday,
          checkOutsCompleted: checkOutsToday,
          pendingCheckIns,
          date: today.toISOString().slice(0, 10),
        },
        rooms: {
          total: totalRooms,
          occupancyRate,
          byStatus: {
            available:   statusMap['available']   ?? 0,
            occupied:    statusMap['occupied']    ?? 0,
            dirty:       statusMap['dirty']       ?? 0,
            maintenance: statusMap['maintenance'] ?? 0,
            blocked:     statusMap['blocked']     ?? 0,
          },
        },
        revenue: {
          monthTotal:   Number(monthRevenue._sum.total ?? 0),
          invoiceCount: monthRevenue._count,
          monthLabel:   now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        },
        upcomingCheckIns,
        recentReservations,
      },
    });
  });
}
