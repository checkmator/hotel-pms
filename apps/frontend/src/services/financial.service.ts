import { api } from './api';
import type {
  AccountPayable, AccountReceivable, Supplier, CostCenter,
  ExpenseCategory, RevenueCategoryFinancial, BankAccount,
  FinancialDashboard, Recurrence,
} from '@/lib/types';

// ── Generic pagination wrapper ────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

// ── Suppliers ─────────────────────────────────────────────────

export const suppliersService = {
  list: (params?: Record<string, string>) =>
    api.get<{ data: Supplier[] }>('/financial/suppliers', { params }).then((r) => r.data.data),

  create: (data: Partial<Supplier>) =>
    api.post<{ data: Supplier }>('/financial/suppliers', data).then((r) => r.data.data),

  update: (id: string, data: Partial<Supplier>) =>
    api.put<{ data: Supplier }>(`/financial/suppliers/${id}`, data).then((r) => r.data.data),

  deactivate: (id: string) =>
    api.delete(`/financial/suppliers/${id}`),
};

// ── Cost Centers ──────────────────────────────────────────────

export const costCentersService = {
  list: () =>
    api.get<{ data: CostCenter[] }>('/financial/cost-centers').then((r) => r.data.data),

  create: (data: { name: string; code: string }) =>
    api.post<{ data: CostCenter }>('/financial/cost-centers', data).then((r) => r.data.data),

  update: (id: string, data: Partial<CostCenter>) =>
    api.put<{ data: CostCenter }>(`/financial/cost-centers/${id}`, data).then((r) => r.data.data),
};

// ── Categories ────────────────────────────────────────────────

export const categoriesService = {
  listExpense: () =>
    api.get<{ data: ExpenseCategory[] }>('/financial/categories/expense').then((r) => r.data.data),

  createExpense: (data: { name: string; parentId?: string }) =>
    api.post<{ data: ExpenseCategory }>('/financial/categories/expense', data).then((r) => r.data.data),

  listRevenue: () =>
    api.get<{ data: RevenueCategoryFinancial[] }>('/financial/categories/revenue').then((r) => r.data.data),

  createRevenue: (data: { name: string }) =>
    api.post<{ data: RevenueCategoryFinancial }>('/financial/categories/revenue', data).then((r) => r.data.data),
};

// ── Bank Accounts ─────────────────────────────────────────────

export const bankAccountsService = {
  list: () =>
    api.get<{ data: BankAccount[] }>('/financial/bank-accounts').then((r) => r.data.data),

  create: (data: Omit<BankAccount, 'id' | 'isActive'>) =>
    api.post<{ data: BankAccount }>('/financial/bank-accounts', data).then((r) => r.data.data),
};

// ── Accounts Payable ──────────────────────────────────────────

export interface APFilters {
  status?: string;
  supplierId?: string;
  costCenterId?: string;
  categoryId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const apService = {
  list: (filters?: APFilters) =>
    api.get<PaginatedResponse<AccountPayable>>('/financial/ap', { params: filters }).then((r) => r.data),

  get: (id: string) =>
    api.get<{ data: AccountPayable }>(`/financial/ap/${id}`).then((r) => r.data.data),

  create: (data: Record<string, unknown>) =>
    api.post<{ data: AccountPayable }>('/financial/ap', data).then((r) => r.data.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put<{ data: AccountPayable }>(`/financial/ap/${id}`, data).then((r) => r.data.data),

  cancel: (id: string) =>
    api.delete(`/financial/ap/${id}`),

  approve: (id: string) =>
    api.post<{ data: AccountPayable }>(`/financial/ap/${id}/approve`).then((r) => r.data.data),

  reject: (id: string) =>
    api.post<{ data: AccountPayable }>(`/financial/ap/${id}/reject`).then((r) => r.data.data),

  pay: (id: string, data: Record<string, unknown>) =>
    api.post<{ data: AccountPayable }>(`/financial/ap/${id}/pay`, data).then((r) => r.data.data),

  overdue: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<AccountPayable>>('/financial/ap/overdue', { params }).then((r) => r.data),

  aging: () =>
    api.get<{ data: unknown[] }>('/financial/ap/aging').then((r) => r.data.data),
};

// ── Accounts Receivable ───────────────────────────────────────

export interface ARFilters {
  status?: string;
  sourceType?: string;
  categoryId?: string;
  costCenterId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const arService = {
  list: (filters?: ARFilters) =>
    api.get<PaginatedResponse<AccountReceivable>>('/financial/ar', { params: filters }).then((r) => r.data),

  get: (id: string) =>
    api.get<{ data: AccountReceivable }>(`/financial/ar/${id}`).then((r) => r.data.data),

  create: (data: Record<string, unknown>) =>
    api.post<{ data: AccountReceivable }>('/financial/ar', data).then((r) => r.data.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put<{ data: AccountReceivable }>(`/financial/ar/${id}`, data).then((r) => r.data.data),

  cancel: (id: string) =>
    api.delete(`/financial/ar/${id}`),

  receive: (id: string, data: Record<string, unknown>) =>
    api.post<{ data: AccountReceivable }>(`/financial/ar/${id}/receive`, data).then((r) => r.data.data),

  split: (id: string, data: { corporateAmount: number; companyName: string; cityLedgerRef?: string }) =>
    api.post(`/financial/ar/${id}/split`, data).then((r) => r.data),

  overdue: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<AccountReceivable>>('/financial/ar/overdue', { params }).then((r) => r.data),

  cityLedger: (params?: { companyName?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<AccountReceivable>>('/financial/ar/city-ledger', { params }).then((r) => r.data),

  otaReconciliation: (params?: { otaName?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<AccountReceivable>>('/financial/ar/ota-reconciliation', { params }).then((r) => r.data),
};

// ── Financial Dashboard ───────────────────────────────────────

export const financialDashboardService = {
  get: () =>
    api.get<{ data: FinancialDashboard }>('/financial/dashboard').then((r) => r.data.data),

  updateOverdue: () =>
    api.post('/financial/maintenance/update-overdue').then((r) => r.data),
};

// ── Recurrences ───────────────────────────────────────────────

export const recurrencesService = {
  list: (params?: { isActive?: boolean }) =>
    api.get<{ data: Recurrence[] }>('/financial/recurrences', { params }).then((r) => r.data.data),

  create: (data: Partial<Recurrence>) =>
    api.post<{ data: Recurrence }>('/financial/recurrences', data).then((r) => r.data.data),

  update: (id: string, data: Partial<Recurrence>) =>
    api.put<{ data: Recurrence }>(`/financial/recurrences/${id}`, data).then((r) => r.data.data),

  deactivate: (id: string) =>
    api.delete(`/financial/recurrences/${id}`),

  generate: () =>
    api.post<{ data: { generated: number; message: string } }>('/financial/recurrences/generate').then((r) => r.data.data),
};

// ── Bank Reconciliation ───────────────────────────────────────

export const reconciliationService = {
  import: (data: { ofxContent: string; bankAccountId: string }) =>
    api.post('/financial/bank-reconciliation/import', data).then((r) => r.data),

  pending: (params?: { bankAccountId?: string; page?: number; limit?: number }) =>
    api.get('/financial/bank-reconciliation/pending', { params }).then((r) => r.data),

  match: (data: { paymentId: string; fitid: string; bankAccountId: string }) =>
    api.post('/financial/bank-reconciliation/match', data).then((r) => r.data),

  unmatch: (paymentId: string) =>
    api.post('/financial/bank-reconciliation/unmatch', { paymentId }).then((r) => r.data),
};
