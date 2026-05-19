import type { ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * URL path to start at (e.g. '/products/1'). Required when the component
   * uses useParams. Pair with `routePattern` to define named segments.
   */
  initialPath?: string;
  /**
   * Route pattern for the MemoryRouter (e.g. '/products/:productId').
   * Defaults to '*' when initialPath is set.
   */
  routePattern?: string;
}

export function renderWithProviders(
  ui: ReactNode,
  options?: RenderWithProvidersOptions,
) {
  const { initialPath, routePattern = '*', ...rtlOptions } = options ?? {};
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    if (initialPath) {
      return (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={[initialPath]}>
              <Routes>
                <Route path={routePattern} element={children} />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );
    }
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>{children}</MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...rtlOptions });
}
