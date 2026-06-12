import { useEffect, useRef } from 'react';
import { logout } from './session';

const IDLE_MS = 5 * 60 * 1000; // 5 minutes of no interaction

// Kiosk security: if an operator walks away, auto-logout after 5 min idle and
// return to login. The remembered user is kept (set at login), so re-login only
// needs the password. Any real touch/key/scroll resets the timer.
export function useIdleLogout(): void {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void logout(); // disconnect the station, clear the token, → /login
      }, IDLE_MS);
    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);
}
