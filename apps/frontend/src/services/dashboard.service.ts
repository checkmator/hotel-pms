import { api } from './api';
import type { DashboardData } from '@/lib/types';

export const dashboardService = {
  async get() {
    const { data } = await api.get<{ data: DashboardData }>('/dashboard');
    return data.data;
  },
};
