/**
 * Seed de demonstração — Hotel PMS
 * Período: 01/01/2026 → 17/03/2026
 * Cobre: quartos, hóspedes, reservas, transações, faturas
 */

import { PrismaClient, TransactionCategory, PaymentMethod } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_ID = '2cf15004-7b6f-4db5-a7e9-7cf748e44294';
const TODAY    = new Date('2026-03-17T12:00:00Z');
const ISS      = 0.05;

// ── Helpers ────────────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r;
}
function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function r2(n: number) { return Math.round(n * 100) / 100; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rng(min: number, max: number) { return min + Math.random() * (max - min); }
function rngInt(min: number, max: number) { return Math.floor(rng(min, max + 1)); }
function vary(base: number, pct = 0.15): number {
  return r2(base * (1 + (Math.random() * 2 - 1) * pct));
}

// ── 1. Novos quartos ───────────────────────────────────────────────────────────

const NEW_ROOMS = [
  { number: '104', type: 'standard'    as const, floor: 1, capacity: 2, basePrice: 190, description: 'Vista para o jardim' },
  { number: '105', type: 'standard'    as const, floor: 1, capacity: 2, basePrice: 195, description: 'Vista para o jardim, cama king' },
  { number: '106', type: 'standard'    as const, floor: 1, capacity: 3, basePrice: 210, description: 'Família — cama casal + solteiro' },
  { number: '203', type: 'deluxe'      as const, floor: 2, capacity: 2, basePrice: 290, description: 'Varanda, vista parcial' },
  { number: '204', type: 'deluxe'      as const, floor: 2, capacity: 2, basePrice: 295, description: 'Varanda panorâmica' },
  { number: '205', type: 'deluxe'      as const, floor: 2, capacity: 3, basePrice: 310, description: 'Família deluxe' },
  { number: '302', type: 'suite'       as const, floor: 3, capacity: 2, basePrice: 460, description: 'Suíte executiva, sala de estar' },
  { number: '303', type: 'suite'       as const, floor: 3, capacity: 4, basePrice: 490, description: 'Suíte família, 2 quartos' },
  { number: '401', type: 'master_suite' as const, floor: 4, capacity: 2, basePrice: 720, description: 'Master com jacuzzi e vista 360°' },
  { number: '402', type: 'master_suite' as const, floor: 4, capacity: 4, basePrice: 780, description: 'Master presidencial, 2 andares' },
];

// ── 2. Hóspedes ────────────────────────────────────────────────────────────────

const GUESTS = [
  { fullName: 'João Paulo Costa',       cpf: '012.345.678-90', email: 'joao.costa@gmail.com',       phone: '(11) 98745-1230', nationality: 'Brasileira' },
  { fullName: 'Lucas Henrique Martins', cpf: '023.456.789-01', email: 'lucas.martins@outlook.com',  phone: '(21) 97823-4561', nationality: 'Brasileira' },
  { fullName: 'Pedro Augusto Ferreira', cpf: '034.567.890-12', email: 'pedroferreira@gmail.com',    phone: '(31) 99214-5672', nationality: 'Brasileira' },
  { fullName: 'Rafael Souza Campos',    cpf: '045.678.901-23', email: 'rafael.campos@hotmail.com',  phone: '(41) 98563-7893', nationality: 'Brasileira' },
  { fullName: 'Carlos Eduardo Lima',    cpf: '056.789.012-34', email: 'carlos.lima@empresa.com.br', phone: '(51) 99874-0124', nationality: 'Brasileira' },
  { fullName: 'Marcos Vinícius Barbosa',cpf: '067.890.123-45', email: 'marcos.barbosa@gmail.com',   phone: '(11) 97412-3455', nationality: 'Brasileira' },
  { fullName: 'Bruno Rodrigues Alves',  cpf: '078.901.234-56', email: 'bruno.alves@yahoo.com.br',   phone: '(21) 98630-2346', nationality: 'Brasileira' },
  { fullName: 'Gustavo Santos Nobre',   cpf: '089.012.345-67', email: 'gustavo.santos@gmail.com',   phone: '(61) 99123-5677', nationality: 'Brasileira' },
  { fullName: 'Felipe Andrade Rocha',   cpf: '090.123.456-78', email: 'felipe.rocha@gmail.com',     phone: '(71) 98741-6788', nationality: 'Brasileira' },
  { fullName: 'André Luis Carvalho',    cpf: '101.234.567-89', email: 'andre.carvalho@uol.com.br',  phone: '(81) 99456-7899', nationality: 'Brasileira' },
  { fullName: 'Rodrigo Pereira Mendes', cpf: '112.345.678-90', email: 'rodrigo.mendes@gmail.com',   phone: '(11) 97234-8900', nationality: 'Brasileira' },
  { fullName: 'Diego Fernandes Gomes',  cpf: '123.456.789-11', email: 'diego.gomes@hotmail.com',    phone: '(21) 98012-9011', nationality: 'Brasileira' },
  { fullName: 'Thiago Oliveira Cruz',   cpf: '134.567.890-22', email: 'thiago.cruz@gmail.com',      phone: '(31) 99301-0122', nationality: 'Brasileira' },
  { fullName: 'Leonardo Dias Souza',    cpf: '145.678.901-33', email: 'leo.souza@empresa.net',      phone: '(41) 98523-1233', nationality: 'Brasileira' },
  { fullName: 'Gabriel Costa Freitas',  cpf: '156.789.012-44', email: 'gabriel.freitas@gmail.com',  phone: '(51) 97845-2344', nationality: 'Brasileira' },
  { fullName: 'Vitor Hugo Monteiro',    cpf: '167.890.123-55', email: 'vitorh@outlook.com',         phone: '(11) 99167-3455', nationality: 'Brasileira' },
  { fullName: 'Alessandro Melo Cunha',  cpf: '178.901.234-66', email: 'ale.cunha@gmail.com',        phone: '(21) 98489-4566', nationality: 'Brasileira' },
  { fullName: 'Renato Borges Teixeira', cpf: '189.012.345-77', email: 'renato.teixeira@uol.com.br', phone: '(61) 99801-5677', nationality: 'Brasileira' },
  { fullName: 'Eduardo Figueiredo',     cpf: '190.123.456-88', email: 'edu.figueiredo@gmail.com',   phone: '(71) 97123-6788', nationality: 'Brasileira' },
  { fullName: 'Fernando Cardoso Lopes', cpf: '201.234.567-99', email: 'fernando.lopes@yahoo.com',   phone: '(81) 98445-7899', nationality: 'Brasileira' },
  { fullName: 'Ana Paula Silveira',     cpf: '212.345.678-00', email: 'anapaula.silveira@gmail.com',phone: '(11) 99767-8900', nationality: 'Brasileira' },
  { fullName: 'Fernanda Cristina Moura',cpf: '223.456.789-11', email: 'fe.moura@hotmail.com',       phone: '(21) 98089-9011', nationality: 'Brasileira' },
  { fullName: 'Beatriz Helena Nascimento',cpf:'234.567.890-22',email: 'bia.nascimento@gmail.com',   phone: '(31) 97411-0122', nationality: 'Brasileira' },
  { fullName: 'Camila Souza Rezende',   cpf: '245.678.901-33', email: 'camila.rezende@uol.com.br',  phone: '(41) 99733-1233', nationality: 'Brasileira' },
  { fullName: 'Juliana Alves Peixoto',  cpf: '256.789.012-44', email: 'juliana.peixoto@gmail.com',  phone: '(51) 98055-2344', nationality: 'Brasileira' },
  { fullName: 'Mariana Rodrigues Vieira',cpf:'267.890.123-55', email: 'mariana.vieira@empresa.com', phone: '(11) 97377-3455', nationality: 'Brasileira' },
  { fullName: 'Patricia Lima Tavares',  cpf: '278.901.234-66', email: 'pati.tavares@gmail.com',     phone: '(21) 99699-4566', nationality: 'Brasileira' },
  { fullName: 'Larissa Gomes Azevedo',  cpf: '289.012.345-77', email: 'larissa.azevedo@hotmail.com',phone: '(61) 98921-5677', nationality: 'Brasileira' },
  { fullName: 'Vanessa Carvalho Nogueira',cpf:'290.123.456-88',email:'vanessa.nogueira@gmail.com',  phone: '(71) 97243-6788', nationality: 'Brasileira' },
  { fullName: 'Adriana Ferreira Paiva', cpf: '301.234.567-99', email: 'adriana.paiva@gmail.com',    phone: '(81) 99565-7899', nationality: 'Brasileira' },
  { fullName: 'Simone Ribeiro Esteves', cpf: '312.345.678-00', email: 'simone.esteves@uol.com.br',  phone: '(11) 98887-8900', nationality: 'Brasileira' },
  { fullName: 'Renata Oliveira Campos', cpf: '323.456.789-11', email: 'renata.campos@gmail.com',    phone: '(21) 97209-9011', nationality: 'Brasileira' },
  { fullName: 'Claudia Santos Borba',   cpf: '334.567.890-22', email: 'claudia.borba@hotmail.com',  phone: '(31) 99531-0122', nationality: 'Brasileira' },
  { fullName: 'Débora Mendes Freire',   cpf: '345.678.901-33', email: 'debora.freire@gmail.com',    phone: '(41) 98853-1233', nationality: 'Brasileira' },
  { fullName: 'Eliane Pereira Braga',   cpf: '356.789.012-44', email: 'eliane.braga@empresa.net',   phone: '(51) 97175-2344', nationality: 'Brasileira' },
  { fullName: 'Fabiana Costa Magalhães',cpf: '367.890.123-55', email: 'fabiana.magalhaes@gmail.com',phone: '(11) 99497-3455', nationality: 'Brasileira' },
  { fullName: 'Helena Souza Vasconcelos',cpf:'378.901.234-66', email: 'helena.vasconcelos@gmail.com',phone:'(21) 98719-4566', nationality: 'Brasileira' },
  { fullName: 'Isabela Rodrigues Teles',cpf: '389.012.345-77', email: 'isa.teles@hotmail.com',      phone: '(61) 97041-5677', nationality: 'Brasileira' },
  { fullName: 'Luana Alves Fonseca',    cpf: '390.123.456-88', email: 'luana.fonseca@gmail.com',    phone: '(71) 99363-6788', nationality: 'Brasileira' },
  { fullName: 'Natália Lima Queiroz',   cpf: '401.234.567-99', email: 'natalia.queiroz@uol.com.br', phone: '(81) 98685-7899', nationality: 'Brasileira' },
  { fullName: 'Priscila Santos Godoi',  cpf: '412.345.678-00', email: 'priscila.godoi@gmail.com',   phone: '(11) 97907-8900', nationality: 'Brasileira' },
  { fullName: 'Samanta Oliveira Chaves',cpf: '423.456.789-11', email: 'samanta.chaves@gmail.com',   phone: '(21) 99229-9011', nationality: 'Brasileira' },
  { fullName: 'Tatiana Carvalho Brandão',cpf:'434.567.890-22', email: 'tati.brandao@hotmail.com',   phone: '(31) 98551-0122', nationality: 'Brasileira' },
  // Estrangeiros
  { fullName: 'James William Harper',   cpf: 'A12345678',      email: 'jwharper@mail.com',          phone: '+1 (212) 555-0147', nationality: 'Americana' },
  { fullName: 'Marie Claire Dubois',    cpf: 'FR9876543',      email: 'marie.dubois@france.fr',     phone: '+33 6 12 34 56 78', nationality: 'Francesa' },
  { fullName: 'Carlos Ramírez Torres',  cpf: 'MEX234567',      email: 'c.ramirez@correo.mx',        phone: '+52 55 1234-5678',  nationality: 'Mexicana' },
  { fullName: 'Yuki Tanaka',            cpf: 'JP8765432',      email: 'yuki.tanaka@japan.jp',       phone: '+81 90-1234-5678',  nationality: 'Japonesa' },
  { fullName: 'Sophia Müller',          cpf: 'DE7654321',      email: 'sophia.muller@mail.de',      phone: '+49 151 12345678',  nationality: 'Alemã' },
  { fullName: 'Oliver Thomas Bennett',  cpf: 'GB6543210',      email: 'o.bennett@uk.co',            phone: '+44 7911 123456',   nationality: 'Britânica' },
  { fullName: 'Isabella Russo',         cpf: 'IT5432109',      email: 'isabella.russo@mail.it',     phone: '+39 02 1234 5678',  nationality: 'Italiana' },
];

// ── 3. Extras por categoria ────────────────────────────────────────────────────

const EXTRAS: Record<string, { desc: string; min: number; max: number }[]> = {
  restaurant: [
    { desc: 'Jantar à la carte (2 pessoas)',      min: 120, max: 280 },
    { desc: 'Almoço executivo',                   min:  65, max: 110 },
    { desc: 'Café da manhã adicional',            min:  45, max:  70 },
    { desc: 'Room service — jantar',              min:  85, max: 160 },
    { desc: 'Refeição especial — aniversário',    min: 180, max: 350 },
    { desc: 'Petiscos e bebidas — bar do hotel',  min:  55, max: 130 },
  ],
  minibar: [
    { desc: 'Consumo frigobar',           min: 38, max:  95 },
    { desc: 'Bebidas e snacks',           min: 25, max:  70 },
    { desc: 'Água mineral (6 garrafas)',  min: 18, max:  35 },
    { desc: 'Bebidas alcoólicas seleção', min: 60, max: 140 },
  ],
  room_service: [
    { desc: 'Room service — café da manhã', min:  55, max: 95 },
    { desc: 'Room service — almoço',        min:  70, max: 120 },
    { desc: 'Room service — jantar',        min:  90, max: 160 },
    { desc: 'Petisco noturno',              min:  35, max:  65 },
  ],
  laundry: [
    { desc: 'Lavanderia — 5 peças',         min:  45, max:  75 },
    { desc: 'Lavanderia — 10 peças',        min:  80, max: 130 },
    { desc: 'Serviço de passadoria',        min:  30, max:  55 },
    { desc: 'Lavagem expressa urgente',     min:  65, max:  95 },
  ],
  parking: [
    { desc: 'Estacionamento coberto (diária)', min: 35, max:  55 },
    { desc: 'Valet parking (2 dias)',           min: 80, max: 110 },
    { desc: 'Estacionamento (3 dias)',          min: 90, max: 140 },
  ],
};

const PAY_METHODS: PaymentMethod[] = ['cash','credit_card','credit_card','credit_card','debit_card','pix','pix'];

// ── 4. Geração de calendário por quarto ────────────────────────────────────────

interface StaySlot {
  checkIn: Date;
  checkOut: Date;
  nights: number;
}

function buildSchedule(roomNumber: string): StaySlot[] {
  // Carnaval 2026: 14-17/fev → gaps menores nesse período
  const slots: StaySlot[] = [];
  let cursor = dateOnly(new Date('2026-01-01'));
  const limit = dateOnly(TODAY);

  while (cursor < limit) {
    const month = cursor.getUTCMonth(); // 0=Jan, 1=Fev, 2=Mar

    // Comprimento da estadia por tipo de quarto
    const isSuite   = ['202','302','303','401','402'].includes(roomNumber);
    const isMaster  = ['301','401','402'].includes(roomNumber);
    const maxNights = isMaster ? 6 : isSuite ? 5 : 4;
    const nights    = rngInt(1, maxNights);

    const checkIn  = dateOnly(cursor);
    const checkOut = addDays(checkIn, nights);

    // Não ultrapassar hoje E não ultrapassar reserva existente no 101 (Mar20)
    const softLimit = roomNumber === '101' ? dateOnly(new Date('2026-03-19')) : limit;
    if (checkOut > softLimit) break;

    slots.push({ checkIn, checkOut, nights });

    // Gap entre estadas (menor em fevereiro = Carnaval)
    const gapBase  = month === 1 ? rngInt(1, 3) : rngInt(1, 5);
    const gapExtra = roomNumber === '101' && checkOut >= dateOnly(new Date('2026-03-17')) ? 99 : gapBase;
    cursor = addDays(checkOut, gapExtra);
  }

  return slots;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🏨  Hotel PMS — Seed Demo\n');

  // ── 4.1 Criar/atualizar quartos novos ──────────────────────────────────────
  console.log('📋  Criando quartos...');
  for (const room of NEW_ROOMS) {
    await prisma.room.upsert({
      where:  { number: room.number },
      create: room,
      update: { basePrice: room.basePrice, description: room.description },
    });
  }
  const allRooms = await prisma.room.findMany({ orderBy: { number: 'asc' } });
  console.log(`   ${allRooms.length} quartos no total.`);

  // ── 4.2 Criar hóspedes ────────────────────────────────────────────────────
  console.log('👤  Criando hóspedes...');
  const guestRecords = [];
  for (const g of GUESTS) {
    const rec = await prisma.guest.upsert({
      where:  { cpfPassport: g.cpf },
      create: { fullName: g.fullName, cpfPassport: g.cpf, email: g.email, phone: g.phone, nationality: g.nationality },
      update: {},
    });
    guestRecords.push(rec);
  }
  console.log(`   ${guestRecords.length} hóspedes no total.`);

  // ── 4.3 Gerar reservas por quarto ─────────────────────────────────────────
  console.log('📅  Gerando reservas...');
  let totalReservations = 0;
  let totalTransactions = 0;
  let totalInvoices     = 0;

  for (const room of allRooms) {
    const schedule = buildSchedule(room.number);

    for (const slot of schedule) {
      const guest     = pick(guestRecords);
      const basePrice = Number(room.basePrice);

      // Preço com variação sazonal ±12%
      const nightlyRate = vary(basePrice, 0.12);
      const baseAmount  = r2(nightlyRate * slot.nights);

      // Desconto: 0–8%, apenas em estadas longas (≥3 noites) ou grupos
      const discountPct = slot.nights >= 3 ? rng(0, 0.08) : rng(0, 0.03);
      const discount    = r2(baseAmount * discountPct);
      const totalAmount = r2(baseAmount - discount);

      // Status baseado em datas
      const now = TODAY;
      let status: 'checked_out' | 'checked_in' | 'confirmed' | 'pending';
      let actualCheckIn:  Date | null = null;
      let actualCheckOut: Date | null = null;

      if (slot.checkOut <= now) {
        status         = 'checked_out';
        actualCheckIn  = new Date(slot.checkIn.getTime() + 14 * 3600_000);  // ~14h
        actualCheckOut = new Date(slot.checkOut.getTime() + 11 * 3600_000); // ~11h checkout
      } else if (slot.checkIn <= now && slot.checkOut > now) {
        status        = 'checked_in';
        actualCheckIn = new Date(slot.checkIn.getTime() + 14 * 3600_000);
      } else {
        status = Math.random() > 0.2 ? 'confirmed' : 'pending';
      }

      // Criar reserva
      const reservation = await prisma.reservation.create({
        data: {
          guestId:     guest.id,
          roomId:      room.id,
          createdById: ADMIN_ID,
          checkInDate: slot.checkIn,
          checkOutDate: slot.checkOut,
          actualCheckIn,
          actualCheckOut,
          status,
          baseAmount:  baseAmount.toString(),
          discount:    discount.toString(),
          totalAmount: totalAmount.toString(),
          notes: slot.nights >= 4 ? pick(['Hóspede frequente', 'Late checkout solicitado', 'Berço adicional', '']) : null,
        },
      });
      totalReservations++;

      // Atualizar status do quarto para occupied se checked_in
      if (status === 'checked_in') {
        await prisma.room.update({ where: { id: room.id }, data: { status: 'occupied' } });
      }

      // ── Criar transações + fatura para hospedagens passadas ou ativas ──
      if (status === 'checked_out' || status === 'checked_in') {

        // Transação principal: diária
        const dailyRateTx = await prisma.transaction.create({
          data: {
            reservationId: reservation.id,
            createdById:   ADMIN_ID,
            category:      'daily_rate' as TransactionCategory,
            description:   `Diária — ${slot.nights} noite(s) × R$ ${nightlyRate.toFixed(2)}`,
            amount:        baseAmount.toString(),
            paymentMethod: null,
            status:        status === 'checked_out' ? 'paid' : 'pending',
            transactionDate: actualCheckIn!,
          },
        });

        // Extras: 0–4 lançamentos adicionais por estada
        const numExtras = slot.nights >= 2 ? rngInt(1, Math.min(4, slot.nights + 1)) : (Math.random() > 0.5 ? 1 : 0);
        const catPool   = slot.nights >= 3
          ? (['restaurant','minibar','room_service','laundry','parking'] as const)
          : (['restaurant','minibar','room_service'] as const);

        const extraTxs = [];
        for (let i = 0; i < numExtras; i++) {
          const cat     = pick([...catPool]);
          const item    = pick(EXTRAS[cat]);
          const amount  = r2(vary(rng(item.min, item.max), 0.10));
          const txDate  = addDays(actualCheckIn!, rngInt(0, Math.max(0, slot.nights - 1)));

          const tx = await prisma.transaction.create({
            data: {
              reservationId: reservation.id,
              createdById:   ADMIN_ID,
              category:      cat as TransactionCategory,
              description:   item.desc,
              amount:        amount.toString(),
              paymentMethod: null,
              status:        status === 'checked_out' ? 'paid' : 'pending',
              transactionDate: txDate,
            },
          });
          extraTxs.push(tx);
          totalTransactions++;
        }
        totalTransactions++; // dailyRate

        // ── Criar fatura ──────────────────────────────────────────────────
        const allAmounts = [Number(dailyRateTx.amount), ...extraTxs.map(t => Number(t.amount))];
        const subtotal   = r2(allAmounts.reduce((s, a) => s + a, 0));
        const taxable    = r2(subtotal - discount);
        const taxes      = r2(taxable * ISS);
        const invTotal   = r2(taxable + taxes);

        const payMethod  = pick(PAY_METHODS);
        const closedAt   = status === 'checked_out' ? actualCheckOut! : null;

        await prisma.invoice.create({
          data: {
            reservationId: reservation.id,
            closedById:    status === 'checked_out' ? ADMIN_ID : null,
            subtotal:      subtotal.toString(),
            taxes:         taxes.toString(),
            discounts:     discount.toString(),
            total:         invTotal.toString(),
            status:        status === 'checked_out' ? 'closed' : 'open',
            closedAt,
          },
        });
        totalInvoices++;

        // Marcar transações com método de pagamento no checkout
        if (status === 'checked_out') {
          await prisma.transaction.updateMany({
            where:  { reservationId: reservation.id },
            data:   { paymentMethod: payMethod },
          });
        }
      }
    }
  }

  // ── 4.4 Resumo ────────────────────────────────────────────────────────────
  const counts = {
    rooms:        await prisma.room.count(),
    guests:       await prisma.guest.count(),
    reservations: await prisma.reservation.count(),
    checkedOut:   await prisma.reservation.count({ where: { status: 'checked_out' } }),
    checkedIn:    await prisma.reservation.count({ where: { status: 'checked_in' } }),
    confirmed:    await prisma.reservation.count({ where: { status: 'confirmed' } }),
    pending:      await prisma.reservation.count({ where: { status: 'pending' } }),
    transactions: await prisma.transaction.count(),
    invoices:     await prisma.invoice.count(),
    invoicesClosed: await prisma.invoice.count({ where: { status: 'closed' } }),
  };

  console.log('\n✅  Seed concluído!\n');
  console.log('📊  Resumo:');
  console.log(`   Quartos:              ${counts.rooms}`);
  console.log(`   Hóspedes:             ${counts.guests}`);
  console.log(`   Reservas totais:      ${counts.reservations}`);
  console.log(`     ├ checked_out:      ${counts.checkedOut}`);
  console.log(`     ├ checked_in:       ${counts.checkedIn}`);
  console.log(`     ├ confirmed:        ${counts.confirmed}`);
  console.log(`     └ pending:          ${counts.pending}`);
  console.log(`   Lançamentos:          ${counts.transactions}`);
  console.log(`   Faturas:              ${counts.invoices} (${counts.invoicesClosed} fechadas)`);

  // Receita total
  const rev = await prisma.invoice.aggregate({ where: { status: 'closed' }, _sum: { total: true } });
  const total = Number(rev._sum.total ?? 0);
  console.log(`\n💰  Receita total bruta: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
}

main()
  .catch((e) => { console.error('❌ Erro:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
