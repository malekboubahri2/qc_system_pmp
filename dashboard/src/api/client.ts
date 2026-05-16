import axios from 'axios';
import { config } from '@/config';

export const client = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((req) => {
  const token = localStorage.getItem('qc_token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('qc_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);
