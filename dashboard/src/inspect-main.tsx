import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { configureAuth } from '@/api/client';
import { InspectApp } from '@/features/inspect/InspectApp';

// The PWA shares the unified login token (ADR-018). On 401, drop it and return
// to the login page.
configureAuth({
  getToken: () => localStorage.getItem('qc_token'),
  onUnauthorized: () => {
    localStorage.removeItem('qc_token');
    window.location.href = '/login';
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InspectApp />
  </StrictMode>,
);

// Cache the app shell so the kiosk still loads offline.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/inspect-sw.js').catch(() => {});
  });
}
