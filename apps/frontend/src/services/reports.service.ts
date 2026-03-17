import { api } from './api';
import type { RevenueReport, OccupancyReport, MonthlyRevenue } from '@/lib/types';

export const reportsService = {
  async revenue(params?: { from?: string; to?: string }) {
    const { data } = await api.get<{ data: RevenueReport }>('/reports/revenue', { params });
    return data.data;
  },

  async occupancy(params?: { from?: string; to?: string }) {
    const { data } = await api.get<{ data: OccupancyReport }>('/reports/occupancy', { params });
    return data.data;
  },

  async revenueMonthly(months = 12) {
    const { data } = await api.get<{ data: MonthlyRevenue[] }>('/reports/revenue-monthly', { params: { months } });
    return data.data;
  },
};
