import { client } from './client';
import type { KpiSnapshot } from '@/types';

// One-day KPI snapshot (taux NC / parts) for the andon board + dashboard tiles.
export async function getKpi(params?: {
  date?: string;
  productId?: number;
}): Promise<KpiSnapshot> {
  const { data } = await client.get<KpiSnapshot>('/kpi', {
    params: {
      ...(params?.date ? { date: params.date } : {}),
      ...(params?.productId ? { product_id: params.productId } : {}),
    },
  });
  return data;
}
