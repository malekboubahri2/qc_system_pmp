import type { ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { OfflineProvider } from './offline/OfflineContext';
import { InspectionFlowProvider } from './flow/InspectionFlowContext';
import { useInspectSession, hasToken, logoutToLogin } from './session';
import { useHeartbeat } from './useHeartbeat';
import { ProductPickerScreen } from './screens/ProductPickerScreen';
import { CategoryPage } from './screens/CategoryPage';
import { SummaryScreen } from './screens/SummaryScreen';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function Heartbeat() {
  useHeartbeat();
  return null;
}

function Splash() {
  return (
    <div className="h-dvh flex items-center justify-center bg-cream">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Only an authenticated `operator` may use the PWA. Anyone else is sent to the
// unified login (or the admin dashboard for an admin).
function RequireOperator({ children }: { children: ReactNode }) {
  const { data: me, isLoading, isError } = useInspectSession();

  if (!hasToken()) {
    logoutToLogin();
    return <Splash />;
  }
  if (isLoading) return <Splash />;
  if (isError || !me) {
    logoutToLogin();
    return <Splash />;
  }
  if (me.role !== 'operator') {
    window.location.href = '/';
    return <Splash />;
  }
  return <>{children}</>;
}

export function InspectApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <OfflineProvider>
        <InspectionFlowProvider>
          <HashRouter>
            <RequireOperator>
              <Heartbeat />
              <Routes>
                <Route path="/" element={<ProductPickerScreen />} />
                <Route path="/pmp" element={<CategoryPage category="PMP" />} />
                <Route path="/inj" element={<CategoryPage category="INJECTION" />} />
                <Route path="/summary" element={<SummaryScreen />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </RequireOperator>
          </HashRouter>
        </InspectionFlowProvider>
      </OfflineProvider>
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
