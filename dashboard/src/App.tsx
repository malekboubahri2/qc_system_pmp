import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/hooks/useAuth';
import { RequireAuth } from '@/components/RequireAuth';
import { AppShell } from '@/components/shared/AppShell';
import { LoginPage } from '@/pages/Login';
import { HomePage } from '@/features/home';
import { ProductsPage } from '@/features/products';
import { ProductDetailPage } from '@/features/product-detail';
import { OperatorsPage } from '@/features/operators';
import { LogsPage } from '@/features/logs';
import { AnalyticsPage } from '@/features/analytics';
import { DevicesPage } from '@/features/devices';
import { SettingsPage } from '@/features/settings';
import { StyleguidePage } from '@/pages/StyleguidePage';
import { LiveStationsPage } from '@/features/live-stations';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function ProtectedShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {import.meta.env.DEV && (
              <Route path="/__styleguide" element={<StyleguidePage />} />
            )}

            <Route
              path="/"
              element={<ProtectedShell><HomePage /></ProtectedShell>}
            />
            <Route
              path="/stations/en-direct"
              element={<ProtectedShell><LiveStationsPage /></ProtectedShell>}
            />
            <Route
              path="/products"
              element={<ProtectedShell><ProductsPage /></ProtectedShell>}
            />
            <Route
              path="/products/:productId"
              element={<ProtectedShell><ProductDetailPage /></ProtectedShell>}
            />
            <Route
              path="/operators"
              element={<ProtectedShell><OperatorsPage /></ProtectedShell>}
            />
            <Route
              path="/logs"
              element={<ProtectedShell><LogsPage /></ProtectedShell>}
            />
            <Route
              path="/analytics"
              element={<ProtectedShell><AnalyticsPage /></ProtectedShell>}
            />
            <Route
              path="/devices"
              element={<ProtectedShell><DevicesPage /></ProtectedShell>}
            />
            <Route
              path="/settings"
              element={<ProtectedShell><SettingsPage /></ProtectedShell>}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'white',
              color: '#2D2D2D',
              border: '1px solid #F5E8DC',
              boxShadow: '0 4px 12px rgba(26, 85, 96, 0.12)',
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
