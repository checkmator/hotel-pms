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
