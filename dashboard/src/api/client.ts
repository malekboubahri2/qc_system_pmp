import axios from 'axios';
import { config } from '@/config';

// The admin dashboard and the inspection PWA are separate entry bundles, so
// each gets its own module instance of this client. Auth is pluggable: the
// admin entry keeps the default (qc_token → /login on 401); the PWA entry calls
// configureAuth() at boot to use the station token and its own 401 handling.
let getToken: () => string | null = () => localStorage.getItem('qc_token');
let onUnauthorized: () => void = () => {
  localStorage.removeItem('qc_token');
  window.location.href = '/login';
};

export function configureAuth(opts: {
  getToken: () => string | null;
  onUnauthorized: () => void;
}): void {
  getToken = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

export const client = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((req) => {
  const token = getToken();
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) onUnauthorized();
    return Promise.reject(err);
  },
);
