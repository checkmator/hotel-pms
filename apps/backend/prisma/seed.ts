/**
 * Seed — popula o banco com dados iniciais para desenvolvimento.
 * Execute: npm run db:seed
 */
import { PrismaClient, RoomType, RoomStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Users ────────────────────────────────────────────────
  const hash = (pw: string) => bcrypt.hash(pw, 10);

  await prisma.user.upsert({
    where: { email: 'admin@hotel.com' },
    update: {},
    create: { name: 'Admin Geral', email: 'admin@hotel.com', passwordHash: await hash('Admin@123'), role: 'admin' },
  });

  await prisma.user.upsert({
    where: { email: 'recepcao@hotel.com' },
    update: {},
    create: { name: 'Recepção', email: 'recepcao@hotel.com', passwordHash: await hash('Recep@123'), role: 'reception' },
  });

  await prisma.user.upsert({
    where: { email: 'camareira@hotel.com' },
    update: {},
    create: { name: 'Camareira', email: 'camareira@hotel.com', passwordHash: await hash('Casa@123'), role: 'housekeeping' },
  });

  // ── Rooms ────────────────────────────────────────────────
  const roomsData: { number: string; type: RoomType; status: RoomStatus; floor: number; capacity: number; basePrice: number }[] = [
    { number: '101', type: 'standard',    status: 'available', floor: 1, capacity: 2, basePrice: 180 },
    { number: '102', type: 'standard',    status: 'available', floor: 1, capacity: 2, basePrice: 180 },
    { number: '103', type: 'deluxe',      status: 'available', floor: 1, capacity: 3, basePrice: 280 },
    { number: '201', type: 'deluxe',      status: 'available', floor: 2, capacity: 3, basePrice: 280 },
    { number: '202', type: 'suite',       status: 'available', floor: 2, capacity: 4, basePrice: 450 },
    { number: '301', type: 'master_suite', status: 'available', floor: 3, capacity: 4, basePrice: 700 },
  ];

  for (const room of roomsData) {
    await prisma.room.upsert({
      where: { number: room.number },
      update: {},
      create: room,
    });
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
