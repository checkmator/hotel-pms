import { api } from './api';
import type { AuditLog } from '@/lib/types';

export interface AuditMeta { total: number; page: number; limit: number; }

export const auditService = {
  async list(params?: {
    entityType?: string;
    action?: string;
    userId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const { data } = await api.get<{ data: AuditLog[]; meta: AuditMeta }>('/audit-logs', { params });
    return data;
  },
};
