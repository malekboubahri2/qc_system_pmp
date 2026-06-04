import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { configureAuth } from '@/api/client';
import { getStationToken, clearStationToken } from '@/features/inspect/station-session';
import { InspectApp } from '@/features/inspect/InspectApp';

// Route every API call through the station token; on 401, drop it and reload
// back to the station-login screen (kiosk re-activation).
configureAuth({
  getToken: getStationToken,
  onUnauthorized: () => {
    clearStationToken();
    window.location.hash = '#/station-login';
    window.location.reload();
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InspectApp />
  </StrictMode>,
);
