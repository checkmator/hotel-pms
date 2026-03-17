import { api } from './api';
import type { Room, RoomWithCount, AccountStatement } from '@/lib/types';

export interface RoomListMeta { total: number; page: number; limit: number; }

export interface CreateRoomPayload {
  number: string;
  type: 'standard' | 'deluxe' | 'suite' | 'master_suite';
  floor: number;
  capacity: number;
  basePrice: number;
  description?: string;
}

export const roomsService = {
  async list(params?: { status?: string; type?: string; floor?: number; page?: number; limit?: number }) {
    const { data } = await api.get<{ data: RoomWithCount[]; meta: RoomListMeta }>('/rooms', { params });
    return data;
  },

  async create(payload: CreateRoomPayload) {
    const { data } = await api.post<{ data: RoomWithCount }>('/rooms', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<CreateRoomPayload>) {
    const { data } = await api.put<{ data: RoomWithCount }>(`/rooms/${id}`, payload);
    return data.data;
  },

  async remove(id: string) {
    await api.delete(`/rooms/${id}`);
  },

  async getAvailability(checkIn: string, checkOut: string): Promise<Room[]> {
    const { data } = await api.get('/rooms/availability', {
      params: { check_in: checkIn, check_out: checkOut },
    });
    return data.data;
  },

  async getHousekeeping(): Promise<Room[]> {
    const { data } = await api.get('/rooms/housekeeping');
    return data.data;
  },

  async updateStatus(roomId: string, status: string, reason?: string): Promise<Room> {
    const { data } = await api.patch(`/rooms/${roomId}/status`, { status, reason });
    return data.data;
  },
};

export const reservationsService = {
  async checkIn(reservationId: string, guestNotes?: string) {
    const { data } = await api.post(`/reservations/${reservationId}/check-in`, { guestNotes });
    return data;
  },

  async checkOut(reservationId: string, payload: {
    paymentMethod: string;
    discountOverride?: number;
    notes?: string;
  }) {
    const { data } = await api.post(`/reservations/${reservationId}/check-out`, payload);
    return data;
  },

  async getInvoice(reservationId: string): Promise<{ data: { lineItems: unknown[]; summary: { subtotal: number; discount: number; taxes: number; total: number }; guest: unknown; room: unknown } }> {
    const { data } = await api.get(`/reservations/${reservationId}/invoice`);
    return data;
  },

  async getStatement(reservationId: string): Promise<AccountStatement> {
    const { data } = await api.get(`/reservations/${reservationId}/transactions`);
    return data.data;
  },

  async postTransaction(reservationId: string, payload: {
    category: string;
    description: string;
    amount: number;
  }) {
    const { data } = await api.post(`/reservations/${reservationId}/transactions`, payload);
    return data;
  },
};
