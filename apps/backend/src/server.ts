import 'dotenv/config';
import { buildApp } from './app';
import { env } from './config/env';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

async function ensureDefaultUsers() {
  const prisma = new PrismaClient();
  try {
    const count = await prisma.user.count();
    if (count === 0) {
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
  } catch (e) {
    console.error('Failed to ensure default users:', e);
  } finally {
    await prisma.$disconnect();
  }
}

(async () => {
  await ensureDefaultUsers();

  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`Hotel PMS API running on port ${env.PORT} [${env.NODE_ENV}]`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
})();
