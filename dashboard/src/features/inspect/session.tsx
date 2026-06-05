import { useQuery } from '@tanstack/react-query';
import { getMe } from '@/api/auth';
import { disconnectDevice } from '@/api/devices';
import type { User } from '@/types';
import { getDeviceId } from './device';

const TOKEN_KEY = 'qc_token';
const SESSION_START_KEY = 'qc_session_start';

export function hasToken(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

// Login time (UTC ISO), used to scope the operator's Taux NC to this session.
export function getSessionStart(): string | null {
  return localStorage.getItem(SESSION_START_KEY);
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
  localStorage.removeItem(SESSION_START_KEY);
  // Back to the unified login (admin bundle).
  window.location.href = '/login';
}

// Explicit operator logout ("Quitter"): tell the server we're going offline
// (so the station flips offline immediately, not after the 90s timeout) while
// the token is still valid, then clear it and return to login.
export async function logout(): Promise<void> {
  try {
    await disconnectDevice(getDeviceId());
  } catch {
    /* offline or already invalid — the heartbeat timeout covers it */
  }
  logoutToLogin();
}
