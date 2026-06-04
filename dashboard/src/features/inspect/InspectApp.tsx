import type { ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { StationSessionProvider, useStationSession } from './station-session';
import { StationLoginScreen } from './screens/StationLoginScreen';
import { ReadyScreen } from './screens/ReadyScreen';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function RequireStation({ children }: { children: ReactNode }) {
  const { isAuthed } = useStationSession();
  if (!isAuthed) return <Navigate to="/station-login" replace />;
  return <>{children}</>;
}

function StationLoginRoute() {
  const { isAuthed } = useStationSession();
  if (isAuthed) return <Navigate to="/" replace />;
  return <StationLoginScreen />;
}

export function InspectApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <StationSessionProvider>
        <HashRouter>
          <Routes>
            <Route path="/station-login" element={<StationLoginRoute />} />
            <Route path="/" element={<RequireStation><ReadyScreen /></RequireStation>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
        <Toaster position="top-center" />
      </StationSessionProvider>
    </QueryClientProvider>
  );
}
