import {
  createContext, useContext, useState, useCallback, type ReactNode,
} from 'react';
import { login as apiLogin } from '@/api/auth';

// The tablet authenticates once as the low-privilege `station` user. Its token
// lives under a distinct key so it never collides with an admin session in the
// same browser (the two surfaces are separate entry bundles).
const TOKEN_KEY = 'qc_station_token';

export function getStationToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearStationToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface StationSessionValue {
  isAuthed: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<StationSessionValue | null>(null);

export function StationSessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStationToken());

  const login = useCallback(async (email: string, password: string) => {
    const auth = await apiLogin(email, password);
    localStorage.setItem(TOKEN_KEY, auth.access_token);
    setToken(auth.access_token);
  }, []);

  const logout = useCallback(() => {
    clearStationToken();
    setToken(null);
  }, []);

  return (
    <Ctx.Provider value={{ isAuthed: !!token, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStationSession(): StationSessionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStationSession must be used within <StationSessionProvider>');
  return ctx;
}
