import axios from 'axios';
import Cookies from 'js-cookie';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token from cookie on every request
api.interceptors.request.use((config) => {
  const token = Cookies.get('hotel_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      Cookies.remove('hotel_token');
      Cookies.remove('hotel_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);
