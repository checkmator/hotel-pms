import { api } from './api';
import type { StaffUser, UserRole } from '@/lib/types';

export interface UserListMeta { total: number; page: number; limit: number; }

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  active?: boolean;
}

export const usersService = {
  async list(params?: { search?: string; page?: number; limit?: number }) {
    const { data } = await api.get<{ data: StaffUser[]; meta: UserListMeta }>('/users', { params });
    return data;
  },

  async create(payload: CreateUserPayload) {
    const { data } = await api.post<{ data: StaffUser }>('/users', payload);
    return data.data;
  },

  async update(id: string, payload: UpdateUserPayload) {
    const { data } = await api.patch<{ data: StaffUser }>(`/users/${id}`, payload);
    return data.data;
  },

  async deactivate(id: string) {
    await api.delete(`/users/${id}`);
  },
};
