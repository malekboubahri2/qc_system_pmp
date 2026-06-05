import { useQuery } from '@tanstack/react-query';
import { getLiveProducts } from '@/api/products';
import { formatTime, timeAgo } from '@/lib/format';
import type { LiveProductDTO, LiveProductOperatorDTO, LiveProductFeedEntryDTO } from '@/types';
import type { ProductView, ProductOperatorView, ProductFeedView } from './types';

const POLL_MS = 4_000;

/** Polls GET /products/live every few seconds and maps it to the panel view
 * model. Relative labels ("il y a …") are computed client-side off a single
 * `now` so they stay fresh between polls (SSE invalidates the query live). */
export function useLiveProducts(): {
  products: ProductView[];
  updatedAt: string;
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['live-products'],
    queryFn: getLiveProducts,
    refetchInterval: POLL_MS,
  });

  const now = Date.now();
  const products = (data?.products ?? []).map((dto) => toProductView(dto, now));
  const updatedAt = data?.updated_at ? formatTime(data.updated_at) : '—';

  return { products, updatedAt, isLoading, isError };
}

function pct(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
}

function toOperatorView(dto: LiveProductOperatorDTO, now: number): ProductOperatorView {
  const name = dto.operator_name ?? '—';
  return {
    id: dto.operator_id,
    name,
    initial: (name[0] ?? '?').toUpperCase(),
    parts: dto.parts,
    ncParts: dto.nc_parts,
    ncRatePct: pct(dto.nc_rate),
    active: dto.active,
    lastAgo: dto.last_at ? timeAgo(dto.last_at, now) : '—',
  };
}

function toFeedView(dto: LiveProductFeedEntryDTO, now: number): ProductFeedView {
  return {
    id: dto.id,
    label: dto.label,
    category: dto.category,
    note: dto.note ?? undefined,
    operatorName: dto.operator_name ?? '—',
    ago: timeAgo(dto.logged_at, now),
    isOther: dto.is_other,
  };
}

function toProductView(dto: LiveProductDTO, now: number): ProductView {
  return {
    id: dto.product_id,
    name: dto.product_name,
    reference: dto.reference ?? undefined,
    client: dto.client ?? undefined,
    active: dto.active,
    lastAgo: dto.last_activity ? timeAgo(dto.last_activity, now) : '—',
    partsToday: dto.parts_today,
    ncParts: dto.nc_parts,
    okParts: dto.ok_parts,
    defectCount: dto.defect_count,
    ncRatePct: pct(dto.nc_rate),
    ncRateDir: dto.nc_parts > 0 ? 'up' : 'flat',
    lastHourParts: dto.last_hour_parts,
    activeOperators: dto.active_operators,
    operators: dto.operators.map((o) => toOperatorView(o, now)),
    feed: dto.feed.map((f) => toFeedView(f, now)),
  };
}
