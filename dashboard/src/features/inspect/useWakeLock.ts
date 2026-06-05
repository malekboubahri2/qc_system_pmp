import { useEffect } from 'react';

// Keeps the kiosk screen awake while the PWA is open. Best-effort: the Wake Lock
// API needs a secure context (HTTPS or localhost) and browser support, so it
// silently no-ops over plain HTTP. Re-acquires when the tab becomes visible
// again (the lock is dropped on tab switch / screen off).
export function useWakeLock(): void {
  useEffect(() => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    if (!nav.wakeLock) return;

    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request('screen');
      } catch {
        /* denied / not a secure context — ignore */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release().catch(() => {});
      void cancelled;
    };
  }, []);
}
