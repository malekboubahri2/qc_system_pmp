import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getKpi } from '@/api/kpi';
import { getLiveProducts } from '@/api/products';
import { useNotifications } from '@/components/shared/notifications';
import { getThresholds, PRODUCT_MIN_PARTS } from '@/lib/thresholds';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Mounted once in the app shell. Raises notifications for:
//  - the dashboard losing/regaining its connection to the server, and
//  - configured thresholds (global Taux NC, per-product Taux NC), evaluated from
//    the live KPI the dashboard already streams (SSE) and a 60s poll.
export function useAppAlerts(): void {
  const { notify } = useNotifications();

  // Connection state.
  useEffect(() => {
    const onOffline = () =>
      notify({
        level: 'critical',
        title: 'Connexion perdue',
        message: 'Le tableau de bord est hors ligne — les données ne se mettent plus à jour.',
        key: 'connection',
        cooldownMs: 60_000,
      });
    const onOnline = () =>
      notify({ level: 'success', title: 'Connexion rétablie', key: 'connection-ok', cooldownMs: 60_000 });
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [notify]);

  // Live KPI (shares the cache with the home page; SSE invalidates it on each
  // inspection, and a 60s interval is the floor).
  const today = todayIso();
  const { data: kpi } = useQuery({
    queryKey: ['kpi', today],
    queryFn: () => getKpi({ date: today }),
    refetchInterval: 60_000,
  });
  const { data: live } = useQuery({
    queryKey: ['live-products'],
    queryFn: getLiveProducts,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const t = getThresholds();

    if (kpi && kpi.inspected_parts > 0) {
      const nc = kpi.nc_rate * 100;
      if (nc >= t.ncCritPct) {
        notify({
          level: 'critical',
          title: 'Taux NC critique',
          message: `Taux NC global ${nc.toFixed(1)}% (seuil ${t.ncCritPct}%) — ${kpi.nc_parts}/${kpi.inspected_parts} pièces`,
          key: 'nc-global',
          cooldownMs: 15 * 60_000,
        });
      } else if (nc >= t.ncWarnPct) {
        notify({
          level: 'warning',
          title: 'Taux NC élevé',
          message: `Taux NC global ${nc.toFixed(1)}% (seuil ${t.ncWarnPct}%)`,
          key: 'nc-global',
          cooldownMs: 15 * 60_000,
        });
      }
    }

    live?.products.forEach((p) => {
      if (p.parts_today < PRODUCT_MIN_PARTS) return;
      const r = p.nc_rate * 100;
      if (r >= t.productNcCritPct) {
        notify({
          level: 'critical',
          title: `Produit en alerte : ${p.product_name}`,
          message: `Taux NC ${r.toFixed(1)}% sur ${p.parts_today} pièces (seuil ${t.productNcCritPct}%)`,
          key: `product-${p.product_id}`,
          cooldownMs: 15 * 60_000,
        });
      }
    });
  }, [kpi, live, notify]);
}
