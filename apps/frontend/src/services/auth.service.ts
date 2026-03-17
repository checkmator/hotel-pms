import Cookies from 'js-cookie';
import { api } from './api';
import type { User } from '@/lib/types';

const COOKIE_OPTS = { expires: 1, sameSite: 'strict' as const };

export const authService = {
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const { data } = await api.post('/auth/login', { email, password });
    Cookies.set('hotel_token', data.token, COOKIE_OPTS);
    Cookies.set('hotel_user', JSON.stringify(data.user), COOKIE_OPTS);
    return data;
  },

  async logout(): Promise<void> {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    Cookies.remove('hotel_token');
    Cookies.remove('hotel_user');
  },

  getStoredUser(): User | null {
    const raw = Cookies.get('hotel_user');
    if (!raw) return null;
    try { return JSON.parse(raw) as User; } catch { return null; }
  },

  getToken(): string | null {
    return Cookies.get('hotel_token') ?? null;
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};
