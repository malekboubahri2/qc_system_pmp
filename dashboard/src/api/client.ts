import axios from 'axios';
import { config } from '@/config';
import { appUrl } from '@/lib/basePath';

// The admin dashboard and the inspection PWA are separate entry bundles, so
// each gets its own module instance of this client. Auth is pluggable: the
// admin entry keeps the default (qc_token → /login on 401); the PWA entry calls
// configureAuth() at boot to use the station token and its own 401 handling.
let getToken: () => string | null = () => localStorage.getItem('qc_token');
let onUnauthorized: () => void = () => {
  localStorage.removeItem('qc_token');
  window.location.href = appUrl('login');
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
  // FormData uploads must go out as multipart with a browser-generated boundary.
  // Drop the instance default 'application/json' so the body isn't mislabelled
  // (which the server would reject with a 422).
  if (req.data instanceof FormData) req.headers.delete('Content-Type');
  return req;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) onUnauthorized();
    return Promise.reject(err);
  },
);
