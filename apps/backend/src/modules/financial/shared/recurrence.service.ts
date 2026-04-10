import { PrismaClient, RecurrenceFrequency } from '@prisma/client';
import { generateAPCode } from '../accounts-payable/ap.routes';

const prisma = new PrismaClient();

function advanceDate(date: Date, frequency: RecurrenceFrequency): Date {
  const next = new Date(date);
  switch (frequency) {
    case 'MONTHLY':    next.setMonth(next.getMonth() + 1); break;
    case 'BIMONTHLY':  next.setMonth(next.getMonth() + 2); break;
    case 'QUARTERLY':  next.setMonth(next.getMonth() + 3); break;
    case 'SEMIANNUAL': next.setMonth(next.getMonth() + 6); break;
    case 'ANNUAL':     next.setFullYear(next.getFullYear() + 1); break;
  }
  return next;
}

export async function generateRecurringPayables(createdById: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const recurrences = await prisma.recurrence.findMany({
    where: {
      isActive: true,
      nextDueDate: { lte: nextMonth },
    },
    include: {
      payables: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { supplierId: true, categoryId: true, costCenterId: true, description: true },
      },
    },
  });

  let generated = 0;

  for (const rec of recurrences) {
    if (!rec.payables[0]) continue;
    const template = rec.payables[0];

    const code = await generateAPCode();
    await prisma.accountPayable.create({
      data: {
        code,
        supplierId: template.supplierId,
        categoryId: template.categoryId,
        costCenterId: template.costCenterId,
        description: rec.description,
        totalAmount: rec.templateAmount,
        issueDate: rec.nextDueDate,
        dueDate: rec.nextDueDate,
        isRecurring: true,
        recurrenceId: rec.id,
        createdById,
      },
    });

    const nextDue = advanceDate(new Date(rec.nextDueDate), rec.frequency);
    await prisma.recurrence.update({
      where: { id: rec.id },
      data: {
        nextDueDate: nextDue,
        isActive: rec.endDate ? nextDue <= new Date(rec.endDate) : true,
      },
    });

    generated++;
  }

  return generated;
}
