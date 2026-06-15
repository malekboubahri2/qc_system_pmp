import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AndonApp } from '@/features/andon/AndonApp';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

// Public, no-login KPI wall display (own hostname, e.g. andon.pmp.com). It only
// reads the unauthenticated GET /kpi/board/public snapshot — no token, no auth
// client, no service worker.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AndonApp />
    </ErrorBoundary>
  </StrictMode>,
);
