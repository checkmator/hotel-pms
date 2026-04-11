import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding financial module...');

  // ── Cost Centers ─────────────────────────────────────────────
  const costCenters = await Promise.all([
    prisma.costCenter.upsert({ where: { code: 'ADM' }, update: {}, create: { name: 'Administrativo', code: 'ADM' } }),
    prisma.costCenter.upsert({ where: { code: 'OPS' }, update: {}, create: { name: 'Operações', code: 'OPS' } }),
    prisma.costCenter.upsert({ where: { code: 'MKT' }, update: {}, create: { name: 'Marketing', code: 'MKT' } }),
    prisma.costCenter.upsert({ where: { code: 'RH' },  update: {}, create: { name: 'Recursos Humanos', code: 'RH' } }),
    prisma.costCenter.upsert({ where: { code: 'TI' },  update: {}, create: { name: 'Tecnologia', code: 'TI' } }),
  ]);
  console.log(`  ✓ ${costCenters.length} cost centers`);

  // ── Expense Categories ───────────────────────────────────────
  const expCats = await Promise.all([
    prisma.expenseCategory.upsert({ where: { name: 'Aluguel' },        update: {}, create: { name: 'Aluguel' } }),
    prisma.expenseCategory.upsert({ where: { name: 'Energia Elétrica' }, update: {}, create: { name: 'Energia Elétrica' } }),
    prisma.expenseCategory.upsert({ where: { name: 'Água e Esgoto' },   update: {}, create: { name: 'Água e Esgoto' } }),
    prisma.expenseCategory.upsert({ where: { name: 'Folha de Pagamento' }, update: {}, create: { name: 'Folha de Pagamento' } }),
    prisma.expenseCategory.upsert({ where: { name: 'Manutenção' },     update: {}, create: { name: 'Manutenção' } }),
    prisma.expenseCategory.upsert({ where: { name: 'Fornecedores Alimentação' }, update: {}, create: { name: 'Fornecedores Alimentação' } }),
    prisma.expenseCategory.upsert({ where: { name: 'Limpeza e Higiene' }, update: {}, create: { name: 'Limpeza e Higiene' } }),
    prisma.expenseCategory.upsert({ where: { name: 'Seguros' },        update: {}, create: { name: 'Seguros' } }),
    prisma.expenseCategory.upsert({ where: { name: 'Impostos e Taxas' }, update: {}, create: { name: 'Impostos e Taxas' } }),
    prisma.expenseCategory.upsert({ where: { name: 'Software e TI' },  update: {}, create: { name: 'Software e TI' } }),
  ]);
  console.log(`  ✓ ${expCats.length} expense categories`);

  // ── Revenue Categories ───────────────────────────────────────
  const revCats = await Promise.all([
    prisma.revenueCategory.upsert({ where: { name: 'Diárias' },          update: {}, create: { name: 'Diárias' } }),
    prisma.revenueCategory.upsert({ where: { name: 'Alimentos e Bebidas' }, update: {}, create: { name: 'Alimentos e Bebidas' } }),
    prisma.revenueCategory.upsert({ where: { name: 'Eventos' },           update: {}, create: { name: 'Eventos' } }),
    prisma.revenueCategory.upsert({ where: { name: 'Serviços Extras' },   update: {}, create: { name: 'Serviços Extras' } }),
    prisma.revenueCategory.upsert({ where: { name: 'OTA - Booking.com' }, update: {}, create: { name: 'OTA - Booking.com' } }),
    prisma.revenueCategory.upsert({ where: { name: 'OTA - Expedia' },     update: {}, create: { name: 'OTA - Expedia' } }),
  ]);
  console.log(`  ✓ ${revCats.length} revenue categories`);

  // ── Bank Accounts ────────────────────────────────────────────
  const banks = await Promise.all([
    prisma.bankAccount.upsert({
      where: { id: '00000000-0000-0000-0000-000000000b01' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000b01',
        bankName: 'Banco do Brasil',
        branch: '1234',
        accountNumber: '56789-0',
        accountType: 'corrente',
        balance: 50000,
      },
    }),
    prisma.bankAccount.upsert({
      where: { id: '00000000-0000-0000-0000-000000000b02' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000b02',
        bankName: 'Nubank',
        branch: '0001',
        accountNumber: '98765-4',
        accountType: 'pagamento',
        balance: 15000,
      },
    }),
  ]);
  console.log(`  ✓ ${banks.length} bank accounts`);

  // ── Suppliers ────────────────────────────────────────────────
  const suppliers = await Promise.all([
    prisma.supplier.upsert({
      where: { document: '12.345.678/0001-99' },
      update: {},
      create: { name: 'Fornecedora de Alimentos Ltda', document: '12.345.678/0001-99', documentType: 'CNPJ', email: 'contato@fornecedora.com', phone: '(11) 3000-0001', city: 'São Paulo', state: 'SP' },
    }),
    prisma.supplier.upsert({
      where: { document: '23.456.789/0001-88' },
      update: {},
      create: { name: 'Limpeza Total Serviços', document: '23.456.789/0001-88', documentType: 'CNPJ', email: 'financeiro@limpezatotal.com', phone: '(11) 3000-0002', city: 'São Paulo', state: 'SP' },
    }),
    prisma.supplier.upsert({
      where: { document: '34.567.890/0001-77' },
      update: {},
      create: { name: 'Tech Solutions Informática', document: '34.567.890/0001-77', documentType: 'CNPJ', email: 'nf@techsolutions.com', phone: '(11) 3000-0003', city: 'São Paulo', state: 'SP' },
    }),
    prisma.supplier.upsert({
      where: { document: '45.678.901/0001-66' },
      update: {},
      create: { name: 'Elétrica Predial SA', document: '45.678.901/0001-66', documentType: 'CNPJ', email: 'cobranca@eletricapredial.com', phone: '(11) 3000-0004', city: 'São Paulo', state: 'SP' },
    }),
    prisma.supplier.upsert({
      where: { document: '123.456.789-09' },
      update: {},
      create: { name: 'João Manutenção', document: '123.456.789-09', documentType: 'CPF', email: 'joao.manutencao@gmail.com', phone: '(11) 99999-0005', city: 'São Paulo', state: 'SP' },
    }),
  ]);
  console.log(`  ✓ ${suppliers.length} suppliers`);

  // ── Get admin user ───────────────────────────────────────────
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!admin) { console.log('  ⚠ No admin user found — skipping AP/AR seed'); return; }

  // ── Accounts Payable ─────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = (offsetDays: number) => { const dt = new Date(today); dt.setDate(dt.getDate() + offsetDays); return dt; };

  const apData = [
    { code: 'AP-00001', supplierId: suppliers[0].id, categoryId: expCats[5].id, costCenterId: costCenters[1].id, description: 'Fornecimento de alimentos – Abril/2026', totalAmount: 4800, issueDate: d(-5), dueDate: d(10), status: 'PENDING' as const, approvalStatus: 'PENDING' as const },
    { code: 'AP-00002', supplierId: suppliers[1].id, categoryId: expCats[6].id, costCenterId: costCenters[1].id, description: 'Serviços de limpeza – Abril/2026', totalAmount: 3200, issueDate: d(-10), dueDate: d(5),  status: 'APPROVED' as const, approvalStatus: 'APPROVED' as const },
    { code: 'AP-00003', supplierId: suppliers[2].id, categoryId: expCats[9].id, costCenterId: costCenters[4].id, description: 'Licença software PMS – Mensal', totalAmount: 890, issueDate: d(-2), dueDate: d(28), status: 'PENDING' as const, approvalStatus: 'PENDING' as const, isRecurring: true },
    { code: 'AP-00004', supplierId: suppliers[3].id, categoryId: expCats[1].id, costCenterId: costCenters[1].id, description: 'Conta de energia – Março/2026', totalAmount: 2150, issueDate: d(-20), dueDate: d(-5), status: 'OVERDUE' as const, approvalStatus: 'APPROVED' as const },
    { code: 'AP-00005', supplierId: suppliers[4].id, categoryId: expCats[4].id, costCenterId: costCenters[1].id, description: 'Manutenção ar-condicionado – Quarto 201', totalAmount: 650, issueDate: d(-3), dueDate: d(7), status: 'PENDING' as const, approvalStatus: 'PENDING' as const },
    { code: 'AP-00006', supplierId: suppliers[0].id, categoryId: expCats[5].id, costCenterId: costCenters[1].id, description: 'Fornecimento bebidas – Março/2026', totalAmount: 1800, issueDate: d(-35), dueDate: d(-15), status: 'PAID' as const, approvalStatus: 'APPROVED' as const, paidAmount: 1800, paymentDate: d(-15) },
    { code: 'AP-00007', supplierId: suppliers[1].id, categoryId: expCats[7].id, costCenterId: costCenters[0].id, description: 'Seguro predial – 2026', totalAmount: 12000, issueDate: d(-60), dueDate: d(120), status: 'APPROVED' as const, approvalStatus: 'APPROVED' as const },
  ];

  for (const ap of apData) {
    await prisma.accountPayable.upsert({
      where: { code: ap.code },
      update: {},
      create: {
        ...ap,
        currency: 'BRL',
        paidAmount: (ap as Record<string, unknown>).paidAmount as number ?? 0,
        paymentDate: (ap as Record<string, unknown>).paymentDate as Date ?? undefined,
        isRecurring: (ap as Record<string, unknown>).isRecurring as boolean ?? false,
        createdById: admin.id,
      },
    });
  }
  console.log(`  ✓ ${apData.length} accounts payable`);

  // ── Accounts Receivable ───────────────────────────────────────
  const arData = [
    { code: 'AR-00001', sourceType: 'OTA' as const, categoryId: revCats[4].id, description: 'Reserva Booking.com – Hóspede Silva', totalAmount: 1200, issueDate: d(-3), dueDate: d(2), otaName: 'Booking.com', otaBookingRef: 'BK-123456', otaCommissionRate: 15, otaCommissionAmt: 180, otaNetAmount: 1020, status: 'PENDING' as const },
    { code: 'AR-00002', sourceType: 'CORPORATE' as const, categoryId: revCats[0].id, costCenterId: costCenters[1].id, description: 'Diárias – Empresa ABC Ltda', totalAmount: 3600, issueDate: d(-5), dueDate: d(25), companyName: 'ABC Ltda', isCityLedger: true, cityLedgerRef: 'CL-2026-001', status: 'PENDING' as const },
    { code: 'AR-00003', sourceType: 'RESERVATION' as const, categoryId: revCats[0].id, description: 'Check-out direto – João Carlos', totalAmount: 850, issueDate: d(-1), dueDate: d(0), status: 'PAID' as const, receivedAmount: 850, receiptDate: d(0) },
    { code: 'AR-00004', sourceType: 'EVENT' as const, categoryId: revCats[2].id, costCenterId: costCenters[2].id, description: 'Evento corporativo – Sala de Reuniões', totalAmount: 5000, issueDate: d(-7), dueDate: d(14), status: 'PENDING' as const },
    { code: 'AR-00005', sourceType: 'OTA' as const, categoryId: revCats[5].id, description: 'Reserva Expedia – Família Torres', totalAmount: 2200, issueDate: d(-10), dueDate: d(-2), otaName: 'Expedia', otaBookingRef: 'EX-789012', otaCommissionRate: 18, otaCommissionAmt: 396, otaNetAmount: 1804, status: 'OVERDUE' as const },
    { code: 'AR-00006', sourceType: 'RESTAURANT' as const, categoryId: revCats[1].id, costCenterId: costCenters[1].id, description: 'Consumo restaurante – Grupo de 20 pessoas', totalAmount: 1800, issueDate: d(-2), dueDate: d(5), status: 'PARTIALLY_PAID' as const, receivedAmount: 900 },
  ];

  for (const ar of arData) {
    await prisma.accountReceivable.upsert({
      where: { code: ar.code },
      update: {},
      create: {
        ...ar,
        currency: 'BRL',
        receivedAmount: (ar as Record<string, unknown>).receivedAmount as number ?? 0,
        receiptDate: (ar as Record<string, unknown>).receiptDate as Date ?? undefined,
        createdById: admin.id,
      },
    });
  }
  console.log(`  ✓ ${arData.length} accounts receivable`);

  // ── Recurrence ───────────────────────────────────────────────
  await prisma.recurrence.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      description: 'Licença software PMS – Mensal',
      frequency: 'MONTHLY',
      startDate: new Date('2026-01-01'),
      nextDueDate: new Date('2026-05-01'),
      templateAmount: 890,
      isActive: true,
    },
  });
  console.log('  ✓ 1 recurrence');

  console.log('\n✅ Financial seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
