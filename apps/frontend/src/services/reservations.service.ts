import { api } from './api';
import type { Reservation, ReservationStatus } from '@/lib/types';

export interface ReservationListMeta { total: number; page: number; limit: number; }

export interface CreateReservationPayload {
  guestId: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  discount?: number;
  notes?: string;
}

export const reservationsService = {
  async list(params?: {
    status?: ReservationStatus;
    guestId?: string;
    roomId?: string;
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
  }) {
    const { data } = await api.get<{ data: Reservation[]; meta: ReservationListMeta }>('/reservations', { params });
    return data;
  },

  async get(id: string) {
    const { data } = await api.get<{ data: Reservation }>(`/reservations/${id}`);
    return data.data;
  },

  async create(payload: CreateReservationPayload) {
    const { data } = await api.post<{ data: Reservation }>('/reservations', payload);
    return data.data;
  },

  async update(id: string, payload: { status?: string; checkInDate?: string; checkOutDate?: string; discount?: number; notes?: string }) {
    const { data } = await api.patch<{ data: Reservation }>(`/reservations/${id}`, payload);
    return data.data;
  },

  async cancel(id: string) {
    const { data } = await api.delete<{ data: Reservation }>(`/reservations/${id}`);
    return data.data;
  },
};
