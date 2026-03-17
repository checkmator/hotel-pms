import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.room.findMany({ orderBy: { number: 'asc' } });
  console.log('Rooms:', rooms.map(r => r.number));

  // 8 occupied, 4 dirty, 4 available
  // Assign first 8 as occupied, next 4 as dirty, rest available
  const occupied = rooms.slice(0, 8).map(r => r.id);
  const dirty    = rooms.slice(8, 12).map(r => r.id);

  await prisma.room.updateMany({ where: { id: { in: occupied } }, data: { status: 'occupied' } });
  await prisma.room.updateMany({ where: { id: { in: dirty    } }, data: { status: 'dirty'    } });

  const updated = await prisma.room.findMany({ select: { number: true, status: true }, orderBy: { number: 'asc' } });
  updated.forEach(r => console.log(`  ${r.number} → ${r.status}`));
  console.log('Done.');
}

main().finally(() => prisma.$disconnect());
