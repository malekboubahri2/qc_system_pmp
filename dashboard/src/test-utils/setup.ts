import { beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { server } from './server';

// MSW lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Provide a token in localStorage so AuthProvider fires /auth/me (which MSW handles).
// The token value is arbitrary — MSW doesn't validate it, and the request
// interceptor in api/client.ts attaches it as Authorization: Bearer <token>.
beforeEach(() => {
  localStorage.setItem('qc_token', 'test-token');
});
afterEach(() => {
  localStorage.clear();
});

// Recharts calls `new ResizeObserver(...)` — must be a class, not an arrow function.
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
