import { client } from './client';
import type { KpiSnapshot } from '@/types';

// KPI snapshot (taux NC / parts). `since` (UTC ISO) scopes an operator to their
// login session rather than the whole day.
export async function getKpi(params?: {
  date?: string;
  productId?: number;
  since?: string;
}): Promise<KpiSnapshot> {
  const { data } = await client.get<KpiSnapshot>('/kpi', {
    params: {
      ...(params?.date ? { date: params.date } : {}),
      ...(params?.productId ? { product_id: params.productId } : {}),
      ...(params?.since ? { since: params.since } : {}),
    },
  });
  return data;
}
