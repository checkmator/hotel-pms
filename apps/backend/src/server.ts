import 'dotenv/config';
import { buildApp } from './app';
import { env } from './config/env';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

async function ensureDefaultData() {
  const prisma = new PrismaClient();
  try {
    // ── Users ─────────────────────────────────────────────────
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

    // ── Rooms (upsert 16 quartos) ─────────────────────────────
    const roomsData = [
      { number: '101', type: 'standard'    as const, floor: 1, capacity: 2, basePrice: 180 },
      { number: '102', type: 'standard'    as const, floor: 1, capacity: 2, basePrice: 180 },
      { number: '103', type: 'deluxe'      as const, floor: 1, capacity: 3, basePrice: 280 },
      { number: '104', type: 'standard'    as const, floor: 1, capacity: 2, basePrice: 190 },
      { number: '105', type: 'standard'    as const, floor: 1, capacity: 2, basePrice: 195 },
      { number: '106', type: 'standard'    as const, floor: 1, capacity: 3, basePrice: 210 },
      { number: '201', type: 'deluxe'      as const, floor: 2, capacity: 3, basePrice: 280 },
      { number: '202', type: 'suite'       as const, floor: 2, capacity: 4, basePrice: 450 },
      { number: '203', type: 'deluxe'      as const, floor: 2, capacity: 2, basePrice: 290 },
      { number: '204', type: 'deluxe'      as const, floor: 2, capacity: 2, basePrice: 295 },
      { number: '205', type: 'deluxe'      as const, floor: 2, capacity: 3, basePrice: 310 },
      { number: '301', type: 'master_suite'as const, floor: 3, capacity: 4, basePrice: 700 },
      { number: '302', type: 'suite'       as const, floor: 3, capacity: 2, basePrice: 460 },
      { number: '303', type: 'suite'       as const, floor: 3, capacity: 4, basePrice: 490 },
      { number: '401', type: 'master_suite'as const, floor: 4, capacity: 2, basePrice: 720 },
      { number: '402', type: 'master_suite'as const, floor: 4, capacity: 4, basePrice: 780 },
    ];
    for (const room of roomsData) {
      await prisma.room.upsert({
        where:  { number: room.number },
        update: {},
        create: { ...room, status: 'available' },
      });
    }

    // ── Demo data (hóspedes + reservas) ───────────────────────
    const guestCount = await prisma.guest.count();
    if (guestCount === 0) {
      console.log('No guests found — seeding demo data...');

      const admin    = await prisma.user.findFirstOrThrow({ where: { role: 'admin' } });
      const allRooms = await prisma.room.findMany();
      const byNumber = Object.fromEntries(allRooms.map(r => [r.number, r]));

      const nights = (ci: Date, co: Date) =>
        Math.round((co.getTime() - ci.getTime()) / 86_400_000);

      // Hóspedes
      const guestsData = [
        { fullName: 'Carlos Eduardo Andrade',  cpfPassport: '12345678901', email: 'carlos.andrade@gmail.com',   phone: '(11) 99201-4532', nationality: 'Brasileira' },
        { fullName: 'Mariana Costa Silva',      cpfPassport: '23456789012', email: 'mariana.silva@outlook.com',  phone: '(21) 98734-2210', nationality: 'Brasileira' },
        { fullName: 'Roberto Ferreira Neto',    cpfPassport: '34567890123', email: 'roberto.ferreira@gmail.com', phone: '(31) 97623-1109', nationality: 'Brasileira' },
        { fullName: 'Ana Paula Rodrigues',      cpfPassport: '45678901234', email: 'apaula.rodrigues@email.com', phone: '(41) 99112-3344', nationality: 'Brasileira' },
        { fullName: 'Fernando Lima Carvalho',   cpfPassport: '56789012345', email: 'fernando.lima@gmail.com',    phone: '(51) 98001-5678', nationality: 'Brasileira' },
        { fullName: 'Juliana Mendes Sousa',     cpfPassport: '67890123456', email: 'juliana.mendes@gmail.com',   phone: '(61) 99345-7890', nationality: 'Brasileira' },
        { fullName: 'Ricardo Alves Pereira',    cpfPassport: '78901234567', email: 'ricardo.alves@gmail.com',    phone: '(71) 98456-1234', nationality: 'Brasileira' },
        { fullName: 'Beatriz Santos Oliveira',  cpfPassport: '89012345678', email: 'beatriz.santos@email.com',   phone: '(81) 97890-5678', nationality: 'Brasileira' },
        { fullName: 'Patricia Rocha Gomes',     cpfPassport: '90123456789', email: 'patricia.rocha@gmail.com',   phone: '(11) 98765-4321', nationality: 'Brasileira' },
        { fullName: 'Alexandre Neves Cruz',     cpfPassport: '01234567890', email: 'alexandre.neves@gmail.com',  phone: '(21) 97654-3210', nationality: 'Brasileira' },
        { fullName: 'Marcos Paulo Freitas',     cpfPassport: '11234567890', email: 'marcos.freitas@gmail.com',   phone: '(31) 96543-2109', nationality: 'Brasileira' },
        { fullName: 'Camila Torres Vieira',     cpfPassport: '22345678901', email: 'camila.torres@email.com',    phone: '(41) 95432-1098', nationality: 'Brasileira' },
        { fullName: 'Diego Costa Martins',      cpfPassport: '33456789012', email: 'diego.martins@gmail.com',    phone: '(51) 99876-5432', nationality: 'Brasileira' },
        { fullName: 'Renata Borges Lima',       cpfPassport: '44567890123', email: 'renata.lima@gmail.com',      phone: '(61) 98765-1234', nationality: 'Brasileira' },
      ];
      const guests = await Promise.all(guestsData.map(g => prisma.guest.create({ data: g })));

      // Checked-in: quartos ficam "occupied"
      const checkedIn = [
        { g: guests[0],  room: '101', ci: '2026-03-20', co: '2026-03-25' },
        { g: guests[1],  room: '102', ci: '2026-03-21', co: '2026-03-24' },
        { g: guests[2],  room: '103', ci: '2026-03-19', co: '2026-03-23' },
        { g: guests[3],  room: '104', ci: '2026-03-22', co: '2026-03-26' },
        { g: guests[4],  room: '105', ci: '2026-03-20', co: '2026-03-27' },
        { g: guests[5],  room: '106', ci: '2026-03-21', co: '2026-03-25' },
        { g: guests[6],  room: '201', ci: '2026-03-22', co: '2026-03-25' },
        { g: guests[7],  room: '202', ci: '2026-03-20', co: '2026-03-28' },
      ];
      for (const { g, room, ci, co } of checkedIn) {
        const r   = byNumber[room];
        const ciD = new Date(ci);
        const coD = new Date(co);
        const base = Number(r.basePrice) * nights(ciD, coD);
        await prisma.reservation.create({
          data: {
            guestId: g.id, roomId: r.id, createdById: admin.id,
            checkInDate: ciD, checkOutDate: coD,
            actualCheckIn: new Date(`${ci}T14:00:00Z`),
            status: 'checked_in',
            baseAmount: base, totalAmount: base,
          },
        });
        await prisma.room.update({ where: { id: r.id }, data: { status: 'occupied' } });
      }

      // Checked-out: quartos ficam "dirty" + invoice fechada
      const checkedOut = [
        { g: guests[8],  room: '203', ci: '2026-03-15', co: '2026-03-20', aco: '2026-03-20T11:00:00Z' },
        { g: guests[9],  room: '204', ci: '2026-03-16', co: '2026-03-21', aco: '2026-03-21T10:00:00Z' },
        { g: guests[10], room: '205', ci: '2026-03-17', co: '2026-03-21', aco: '2026-03-21T11:30:00Z' },
        { g: guests[11], room: '301', ci: '2026-03-14', co: '2026-03-20', aco: '2026-03-20T12:00:00Z' },
      ];
      for (const { g, room, ci, co, aco } of checkedOut) {
        const r      = byNumber[room];
        const ciD    = new Date(ci);
        const coD    = new Date(co);
        const acoD   = new Date(aco);
        const base   = Number(r.basePrice) * nights(ciD, coD);
        const taxes  = Math.round(base * 0.05 * 100) / 100;
        const res = await prisma.reservation.create({
          data: {
            guestId: g.id, roomId: r.id, createdById: admin.id,
            checkInDate: ciD, checkOutDate: coD,
            actualCheckIn: new Date(`${ci}T14:00:00Z`),
            actualCheckOut: acoD,
            status: 'checked_out',
            baseAmount: base, totalAmount: base,
          },
        });
        await prisma.invoice.create({
          data: {
            reservationId: res.id, closedById: admin.id,
            subtotal: base, taxes, discounts: 0, total: base + taxes,
            status: 'closed', closedAt: acoD,
          },
        });
        await prisma.room.update({ where: { id: r.id }, data: { status: 'dirty' } });
      }

      // Confirmed: reservas futuras (quartos permanecem available)
      const confirmed = [
        { g: guests[12], room: '302', ci: '2026-03-25', co: '2026-03-28' },
        { g: guests[13], room: '303', ci: '2026-03-24', co: '2026-03-27' },
      ];
      for (const { g, room, ci, co } of confirmed) {
        const r    = byNumber[room];
        const ciD  = new Date(ci);
        const coD  = new Date(co);
        const base = Number(r.basePrice) * nights(ciD, coD);
        await prisma.reservation.create({
          data: {
            guestId: g.id, roomId: r.id, createdById: admin.id,
            checkInDate: ciD, checkOutDate: coD,
            status: 'confirmed',
            baseAmount: base, totalAmount: base,
          },
        });
      }

      console.log('Demo data seeded successfully.');
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
