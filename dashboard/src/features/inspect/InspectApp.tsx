import type { ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { StationSessionProvider, useStationSession } from './station-session';
import { InspectionFlowProvider } from './flow/InspectionFlowContext';
import { StationLoginScreen } from './screens/StationLoginScreen';
import { OperatorPickerScreen } from './screens/OperatorPickerScreen';
import { ProductPickerScreen } from './screens/ProductPickerScreen';
import { DefectGridScreen } from './screens/DefectGridScreen';
import { SummaryScreen } from './screens/SummaryScreen';

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
        <InspectionFlowProvider>
          <HashRouter>
            <Routes>
              <Route path="/station-login" element={<StationLoginRoute />} />
              <Route
                path="/"
                element={<RequireStation><OperatorPickerScreen /></RequireStation>}
              />
              <Route
                path="/product"
                element={<RequireStation><ProductPickerScreen /></RequireStation>}
              />
              <Route
                path="/inspect"
                element={<RequireStation><DefectGridScreen /></RequireStation>}
              />
              <Route
                path="/summary"
                element={<RequireStation><SummaryScreen /></RequireStation>}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
        </InspectionFlowProvider>
        <Toaster position="top-center" />
      </StationSessionProvider>
    </QueryClientProvider>
  );
}
