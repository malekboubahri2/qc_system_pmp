import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/hooks/useAuth';
import { RequireAuth } from '@/components/RequireAuth';
import { LoginPage } from '@/pages/Login';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <RequireAuth>
                  {/* Dashboard shell — pages added in Day 9–11 */}
                  <div className="min-h-screen bg-cream flex items-center justify-center">
                    <p className="text-ink-muted">Dashboard — à venir</p>
                  </div>
                </RequireAuth>
              }
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
