export type UserRole = 'admin' | 'reception' | 'housekeeping';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  token: string | null;
}

export type RoomType = 'standard' | 'deluxe' | 'suite' | 'master_suite';
export type RoomStatus = 'available' | 'occupied' | 'dirty' | 'maintenance' | 'blocked';

export interface Room {
  id: string;
  number: string;
  type: RoomType;
  status: RoomStatus;
  floor: number;
  capacity: number;
  basePrice: string;
  description: string | null;
  isAvailable?: boolean;
  reservations?: ReservationSummary[];
}

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export interface ReservationSummary {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
}

export interface Guest {
  id: string;
  fullName: string;
  cpfPassport: string;
  email?: string;
  phone?: string;
  nationality?: string;
  birthDate?: string;
  address?: string;
  notes?: string;
}

export interface Reservation {
  id: string;
  guest: Guest;
  room: Room;
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn?: string;
  actualCheckOut?: string;
  status: ReservationStatus;
  baseAmount: string;
  discount: string;
  totalAmount: string;
  notes?: string;
  invoices?: Invoice[];
  createdAt?: string;
}

export type TransactionCategory =
  | 'daily_rate'
  | 'minibar'
  | 'laundry'
  | 'restaurant'
  | 'room_service'
  | 'parking'
  | 'extra';

export interface Transaction {
  id: string;
  category: TransactionCategory;
  description: string;
  amount: string;
  status: 'pending' | 'paid' | 'refunded' | 'cancelled';
  transactionDate: string;
  createdBy: { name: string };
}

export interface Invoice {
  id: string;
  subtotal: string;
  taxes: string;
  discounts: string;
  total: string;
  status: 'open' | 'closed' | 'voided';
  closedAt?: string;
}

export interface AccountStatement {
  transactions: Transaction[];
  invoice: Invoice | null;
  runningTotal: number;
}

// ── Users (staff management) ──────────────────────────────────────────────────
export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Reports ───────────────────────────────────────────────────────────────────
export interface RevenueDay {
  date: string;
  revenue: number;
}

export interface RevenueCategory {
  category: string;
  total: number;
  count: number;
}

export interface RevenueReport {
  period: { from: string | null; to: string | null };
  summary: {
    invoicesCount: number;
    subtotal: number;
    taxes: number;
    discounts: number;
    total: number;
    checkedOutReservations: number;
    cancelledReservations: number;
  };
  dailySeries: RevenueDay[];
  byCategory: RevenueCategory[];
}

export interface OccupancyDay {
  date: string;
  occupied: number;
  total: number;
  rate: number;
}

export interface OccupancyReport {
  period: { from: string; to: string };
  totalRooms: number;
  avgOccupancyRate: number;
  dailySeries: OccupancyDay[];
}

// ── Audit Logs ────────────────────────────────────────────────────────────────
export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout';

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: UserRole };
}

// ── Room with count ───────────────────────────────────────────────────────────
export interface RoomWithCount extends Room {
  _count: { reservations: number };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface DashboardData {
  today: {
    checkInsCompleted: number;
    checkOutsCompleted: number;
    pendingCheckIns: number;
    date: string;
  };
  rooms: {
    total: number;
    occupancyRate: number;
    byStatus: Record<string, number>;
  };
  revenue: {
    monthTotal: number;
    invoiceCount: number;
    monthLabel: string;
  };
  upcomingCheckIns: Array<{
    id: string;
    checkInDate: string;
    checkOutDate: string;
    guest: { fullName: string; cpfPassport: string };
    room: { number: string; type: RoomType };
  }>;
  recentReservations: Array<{
    id: string;
    status: ReservationStatus;
    checkInDate: string;
    checkOutDate: string;
    totalAmount: string;
    createdAt: string;
    guest: { fullName: string };
    room: { number: string };
  }>;
}

// ── Monthly Revenue ───────────────────────────────────────────────────────────
export interface MonthlyRevenue {
  month: string;   // YYYY-MM
  label: string;   // e.g. "jan. 26"
  total: number;
  count: number;
}

// ── Invoice Preview (GET /reservations/:id/invoice) ───────────────────────────
export interface InvoiceLineItem {
  id: string;
  category: TransactionCategory;
  description: string;
  amount: string | number;
  transactionDate: string;
  status: string;
  paymentMethod?: string | null;
}

export interface InvoicePreview {
  reservation: {
    id: string;
    status: string;
    checkInDate: string;
    checkOutDate: string;
    actualCheckIn?: string | null;
    actualCheckOut?: string | null;
  };
  guest: { fullName: string; cpfPassport: string; email?: string };
  room: { number: string; type: RoomType };
  lineItems: InvoiceLineItem[];
  summary: { subtotal: number; discount: number; taxes: number; total: number };
  invoiceId: string | null;
  invoiceStatus: string;
  paymentMethod: string | null;
  closedAt: string | null;
}

// ── Financial Module ──────────────────────────────────────────────────────────

export type FinancialStatus = 'PENDING' | 'APPROVED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'IN_DISPUTE';
export type FinancialPaymentMethod = 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'BANK_SLIP' | 'CHECK' | 'OTA_TRANSFER' | 'VOUCHER' | 'OTHER';
export type RecurrenceFrequency = 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';
export type ARSourceType = 'RESERVATION' | 'EVENT' | 'RESTAURANT' | 'OTA' | 'AGENCY' | 'CORPORATE' | 'WALK_IN' | 'OTHER';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Supplier {
  id: string;
  name: string;
  tradeName: string | null;
  document: string;
  documentType: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccount: string | null;
  pixKey: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  children?: ExpenseCategory[];
}

export interface RevenueCategoryFinancial {
  id: string;
  name: string;
  isActive: boolean;
}

export interface CostCenter {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface BankAccount {
  id: string;
  bankName: string;
  branch: string;
  accountNumber: string;
  accountType: string;
  balance: string;
  isActive: boolean;
}

export interface FinancialInstallment {
  id: number;
  installmentNumber: number;
  amount: string;
  dueDate: string;
  paidAmount: string;
  status: FinancialStatus;
}

export interface FinancialPayment {
  id: string;
  amount: string;
  paymentDate: string;
  method: FinancialPaymentMethod;
  transactionRef: string | null;
  notes: string | null;
  isReconciled: boolean;
  bankAccount?: { bankName: string; accountNumber: string } | null;
}

export interface AccountPayable {
  id: string;
  code: string;
  description: string;
  totalAmount: string;
  paidAmount: string;
  dueDate: string;
  issueDate: string;
  paymentDate: string | null;
  status: FinancialStatus;
  approvalStatus: ApprovalStatus;
  documentNumber: string | null;
  documentType: string | null;
  notes: string | null;
  isRecurring: boolean;
  issRetained: string | null;
  irrfRetained: string | null;
  supplier?: { id: string; name: string };
  category?: { id: string; name: string };
  costCenter?: { id: string; name: string };
  createdBy?: { id: string; name: string };
  approvedBy?: { id: string; name: string } | null;
  installments?: FinancialInstallment[];
  payments?: FinancialPayment[];
  auditLogs?: Array<{ id: string; action: string; performedAt: string; performedById: string }>;
  _count?: { installments: number; payments: number };
}

export interface AccountReceivable {
  id: string;
  code: string;
  sourceType: ARSourceType;
  description: string;
  totalAmount: string;
  receivedAmount: string;
  dueDate: string;
  issueDate: string;
  receiptDate: string | null;
  status: FinancialStatus;
  documentNumber: string | null;
  notes: string | null;
  companyName: string | null;
  otaName: string | null;
  otaBookingRef: string | null;
  otaCommissionRate: string | null;
  otaCommissionAmt: string | null;
  otaNetAmount: string | null;
  isCityLedger: boolean;
  cityLedgerRef: string | null;
  category?: { id: string; name: string };
  costCenter?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string };
  installments?: FinancialInstallment[];
  payments?: FinancialPayment[];
  auditLogs?: Array<{ id: string; action: string; performedAt: string; performedById: string }>;
  _count?: { installments: number; payments: number };
}

export interface FinancialKPIs {
  totalAPPending: number;
  totalAPCount: number;
  totalARPending: number;
  totalARCount: number;
  overdueAP: number;
  overdueAPCount: number;
  overdueAR: number;
  overdueARCount: number;
  projectedBalance: number;
}

export interface CashFlowDay {
  date: string;
  inflow: number;
  outflow: number;
  balance: number;
}

export interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  apCount: number;
  apAmount: number;
  arCount: number;
  arAmount: number;
}

export interface FinancialDashboard {
  kpis: FinancialKPIs;
  upcomingAP: AccountPayable[];
  upcomingAR: AccountReceivable[];
  cashFlow: CashFlowDay[];
  aging: AgingBucket[];
}

export interface Recurrence {
  id: string;
  description: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate: string | null;
  nextDueDate: string;
  templateAmount: string;
  isActive: boolean;
  _count?: { payables: number };
}

// ── Fiscal Note (NFS-e) ───────────────────────────────────────────────────────
export type FiscalNoteStatus = 'pending' | 'emitted' | 'cancelled' | 'error';

export interface FiscalNote {
  id: string;
  reservationId: string;
  invoiceId: string;
  prestadorCnpj: string;
  prestadorRazaoSocial: string;
  prestadorIm: string | null;
  prestadorMunicipio: string;
  tomadorDocumento: string;
  tomadorNome: string;
  tomadorEmail: string | null;
  discriminacao: string;
  codigoServico: string;
  valorServicos: string;
  valorDeducoes: string;
  baseCalculo: string;
  aliquotaIss: string;
  valorIss: string;
  valorLiquido: string;
  status: FiscalNoteStatus;
  numero: string | null;
  serie: string;
  protocolo: string | null;
  codigoVerificacao: string | null;
  motivoCancelamento: string | null;
  errorMessage: string | null;
  createdAt: string;
  emittedAt: string | null;
  cancelledAt: string | null;
}
