import { useQuery } from '@tanstack/react-query';
import { getMe } from '@/api/auth';
import type { User } from '@/types';

const TOKEN_KEY = 'qc_token';

export function hasToken(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

// Resolves the logged-in operator from the shared login token. The unified
// dashboard login stores the token and redirects operators here (ADR-018).
export function useInspectSession() {
  const query = useQuery<User>({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    enabled: hasToken(),
    retry: false,
  });
  return query;
}

export function logoutToLogin(): void {
  localStorage.removeItem(TOKEN_KEY);
  // Back to the unified login (admin bundle).
  window.location.href = '/login';
}
