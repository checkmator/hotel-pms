import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CashFlowDay {
  date: string;
  inflow: number;
  outflow: number;
  balance: number;
}

export async function getCashFlowProjection(days = 90): Promise<CashFlowDay[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + days);

  const [apItems, arItems] = await Promise.all([
    prisma.accountPayable.findMany({
      where: {
        dueDate: { gte: today, lte: end },
        status: { in: ['PENDING', 'APPROVED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      select: { dueDate: true, totalAmount: true, paidAmount: true },
    }),
    prisma.accountReceivable.findMany({
      where: {
        dueDate: { gte: today, lte: end },
        status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      select: { dueDate: true, totalAmount: true, receivedAmount: true },
    }),
  ]);

  // Build a map by date string
  const map = new Map<string, { inflow: number; outflow: number }>();

  for (const ap of apItems) {
    const key = ap.dueDate.toISOString().slice(0, 10);
    const entry = map.get(key) ?? { inflow: 0, outflow: 0 };
    entry.outflow += Number(ap.totalAmount) - Number(ap.paidAmount);
    map.set(key, entry);
  }

  for (const ar of arItems) {
    const key = ar.dueDate.toISOString().slice(0, 10);
    const entry = map.get(key) ?? { inflow: 0, outflow: 0 };
    entry.inflow += Number(ar.totalAmount) - Number(ar.receivedAmount);
    map.set(key, entry);
  }

  // Build ordered series
  const result: CashFlowDay[] = [];
  let runningBalance = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const entry = map.get(key) ?? { inflow: 0, outflow: 0 };
    runningBalance += entry.inflow - entry.outflow;
    result.push({
      date: key,
      inflow: Math.round(entry.inflow * 100) / 100,
      outflow: Math.round(entry.outflow * 100) / 100,
      balance: Math.round(runningBalance * 100) / 100,
    });
  }

  return result;
}
