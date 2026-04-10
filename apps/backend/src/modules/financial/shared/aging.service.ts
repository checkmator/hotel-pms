import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  apCount: number;
  apAmount: number;
  arCount: number;
  arAmount: number;
}

const BUCKETS = [
  { label: 'A vencer', minDays: -Infinity, maxDays: 0 },
  { label: '1-30 dias', minDays: 1, maxDays: 30 },
  { label: '31-60 dias', minDays: 31, maxDays: 60 },
  { label: '61-90 dias', minDays: 61, maxDays: 90 },
  { label: '> 90 dias', minDays: 91, maxDays: null },
];

export async function getAgingReport() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [openAP, openAR] = await Promise.all([
    prisma.accountPayable.findMany({
      where: { status: { in: ['PENDING', 'APPROVED', 'PARTIALLY_PAID', 'OVERDUE'] } },
      select: { dueDate: true, totalAmount: true, paidAmount: true },
    }),
    prisma.accountReceivable.findMany({
      where: { status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
      select: { dueDate: true, totalAmount: true, receivedAmount: true },
    }),
  ]);

  const buckets: AgingBucket[] = BUCKETS.map((b) => ({
    label: b.label,
    minDays: b.minDays === -Infinity ? -9999 : b.minDays,
    maxDays: b.maxDays,
    apCount: 0,
    apAmount: 0,
    arCount: 0,
    arAmount: 0,
  }));

  for (const ap of openAP) {
    const diffDays = Math.floor((today.getTime() - new Date(ap.dueDate).getTime()) / 86400000);
    const remaining = Number(ap.totalAmount) - Number(ap.paidAmount);
    const bucket = findBucket(buckets, diffDays);
    if (bucket) { bucket.apCount++; bucket.apAmount += remaining; }
  }

  for (const ar of openAR) {
    const diffDays = Math.floor((today.getTime() - new Date(ar.dueDate).getTime()) / 86400000);
    const remaining = Number(ar.totalAmount) - Number(ar.receivedAmount);
    const bucket = findBucket(buckets, diffDays);
    if (bucket) { bucket.arCount++; bucket.arAmount += remaining; }
  }

  return buckets.map((b) => ({
    ...b,
    apAmount: Math.round(b.apAmount * 100) / 100,
    arAmount: Math.round(b.arAmount * 100) / 100,
  }));
}

function findBucket(buckets: AgingBucket[], diffDays: number) {
  if (diffDays <= 0) return buckets[0];
  if (diffDays <= 30) return buckets[1];
  if (diffDays <= 60) return buckets[2];
  if (diffDays <= 90) return buckets[3];
  return buckets[4];
}
