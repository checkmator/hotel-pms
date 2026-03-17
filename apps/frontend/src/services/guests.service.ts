import { api } from './api';
import type { Guest } from '@/lib/types';

export interface GuestListMeta { total: number; page: number; limit: number; }
export interface GuestWithCount extends Guest { _count: { reservations: number } }

export const guestsService = {
  async list(params?: { search?: string; page?: number; limit?: number }) {
    const { data } = await api.get<{ data: GuestWithCount[]; meta: GuestListMeta }>('/guests', { params });
    return data;
  },

  async get(id: string) {
    const { data } = await api.get<{ data: Guest & { reservations: unknown[] } }>(`/guests/${id}`);
    return data.data;
  },

  async create(payload: Omit<Guest, 'id'>) {
    const { data } = await api.post<{ data: Guest }>('/guests', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<Omit<Guest, 'id'>>) {
    const { data } = await api.put<{ data: Guest }>(`/guests/${id}`, payload);
    return data.data;
  },

  async remove(id: string) {
    await api.delete(`/guests/${id}`);
  },
};
