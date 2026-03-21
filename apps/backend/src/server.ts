import 'dotenv/config';
import { buildApp } from './app';
import { env } from './config/env';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

async function ensureDefaultData() {
  const prisma = new PrismaClient();
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('No users found — creating default users...');
      const rounds = 10;
      await prisma.user.createMany({
        data: [
          { name: 'Admin Geral',  email: 'admin@hotel.com',     passwordHash: await bcrypt.hash('Admin@123', rounds), role: 'admin' },
          { name: 'Recepção',     email: 'recepcao@hotel.com',  passwordHash: await bcrypt.hash('Recep@123', rounds), role: 'reception' },
          { name: 'Camareira',    email: 'camareira@hotel.com', passwordHash: await bcrypt.hash('Casa@123',  rounds), role: 'housekeeping' },
        ],
      });
      console.log('Default users created.');
    }

    const roomCount = await prisma.room.count();
    if (roomCount === 0) {
      console.log('No rooms found — creating default rooms...');
      await prisma.room.createMany({
        data: [
          { number: '101', type: 'standard',    status: 'available', floor: 1, capacity: 2, basePrice: 180 },
          { number: '102', type: 'standard',    status: 'available', floor: 1, capacity: 2, basePrice: 180 },
          { number: '103', type: 'deluxe',      status: 'available', floor: 1, capacity: 3, basePrice: 280 },
          { number: '201', type: 'deluxe',      status: 'available', floor: 2, capacity: 3, basePrice: 280 },
          { number: '202', type: 'suite',       status: 'available', floor: 2, capacity: 4, basePrice: 450 },
          { number: '301', type: 'master_suite', status: 'available', floor: 3, capacity: 4, basePrice: 700 },
        ],
      });
      console.log('Default rooms created.');
    }
  } catch (e) {
    console.error('Failed to ensure default data:', e);
  } finally {
    await prisma.$disconnect();
  }
}

(async () => {
  await ensureDefaultData();

  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`Hotel PMS API running on port ${env.PORT} [${env.NODE_ENV}]`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
})();
