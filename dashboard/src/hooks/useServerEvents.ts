import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { config } from '@/config';

const LIVE_KEYS = new Set([
  'live-stations', 'inspection-logs', 'stats', 'logs', 'devices', 'kpi',
]);

// Subscribes to the server's SSE stream and refetches live data the instant an
// inspection lands — near-real-time dashboard with polling as a slow fallback.
// EventSource reconnects automatically; config/auth/products queries are left
// alone since an inspection doesn't change them.
export function useServerEvents(): void {
  const qc = useQueryClient();

  useEffect(() => {
    const es = new EventSource(`${config.apiBaseUrl}/events`);

    es.addEventListener('inspection', () => {
      qc.invalidateQueries({
        predicate: (q) => LIVE_KEYS.has(q.queryKey[0] as string),
      });
    });

    return () => es.close();
  }, [qc]);
}
