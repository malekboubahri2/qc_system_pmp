import {
  createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode,
} from 'react';
import { createInspection } from '@/api/inspections';
import { offlineQueue } from './queue';

interface OfflineValue {
  online: boolean;
  pending: number;
  syncing: boolean;
  sync: () => void;
}

const Ctx = createContext<OfflineValue | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(
    () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  );
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refresh = useCallback(() => {
    offlineQueue.count().then(setPending).catch(() => {});
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await offlineQueue.drain((p) => createInspection(p));
    } catch {
      /* leave items queued; next 'online' event retries */
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      refresh();
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    const unsub = offlineQueue.subscribe(refresh);
    const onOnline = () => { setOnline(true); void sync(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    // Drain anything left from a previous session if we boot online.
    if (typeof navigator === 'undefined' || navigator.onLine) void sync();
    return () => {
      unsub();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refresh, sync]);

  return (
    <Ctx.Provider value={{ online, pending, syncing, sync }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOffline(): OfflineValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOffline must be used within <OfflineProvider>');
  return ctx;
}
