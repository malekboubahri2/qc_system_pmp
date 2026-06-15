import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { configureAuth } from '@/api/client';
import { InspectApp } from '@/features/inspect/InspectApp';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { appUrl } from '@/lib/basePath';

// The PWA shares the unified login token (ADR-018). On 401, drop it and return
// to the login page.
configureAuth({
  getToken: () => localStorage.getItem('qc_token'),
  onUnauthorized: () => {
    localStorage.removeItem('qc_token');
    window.location.href = appUrl('login');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <InspectApp />
    </ErrorBoundary>
  </StrictMode>,
);

// Cache the app shell so the kiosk still loads offline. The SW lives under the
// app base (e.g. /level3/inspect-sw.js) and is scoped to it.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(appUrl('inspect-sw.js'), { scope: appUrl() })
      .catch(() => {});
  });
}
