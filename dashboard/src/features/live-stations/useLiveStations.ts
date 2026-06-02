import { useQuery } from '@tanstack/react-query';
import { getLiveStations } from '@/api/devices';
import { formatTime, timeAgo } from '@/lib/format';
import type { LiveStationDTO } from '@/types';
import type { StationView } from './types';

const POLL_MS = 10_000;

/** Polls GET /devices/live every 10s and maps it to the panel view model.
 * Relative labels ("il y a …") are computed client-side off a single `now`
 * so they stay fresh on each poll. */
export function useLiveStations(): {
  stations: StationView[];
  updatedAt: string;
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['live-stations'],
    queryFn: getLiveStations,
    refetchInterval: POLL_MS,
  });

  const now = Date.now();
  const stations = (data?.stations ?? []).map((dto, i) => toStationView(dto, i, now));
  const updatedAt = data?.updated_at ? formatTime(data.updated_at) : '—';

  return { stations, updatedAt, isLoading, isError };
}

function toStationView(dto: LiveStationDTO, index: number, now: number): StationView {
  const productRef = dto.product_id != null ? `#${dto.product_id}` : '—';
  return {
    id: dto.device_id,
    name: `Station ${index + 1}`,
    deviceId: dto.device_id,
    online: dto.online,
    connSince: dto.last_seen ? timeAgo(dto.last_seen, now) : '—',
    sessionActive: dto.session_active,
    session: {
      operatorInitial: (dto.operator_name?.[0] ?? '?').toUpperCase(),
      operatorName: dto.operator_name ?? '—',
      connectedAt: dto.session_started_at ? formatTime(dto.session_started_at) : '—',
      productName: dto.product_name ?? '—',
      productRef,
      defectCount: dto.defect_count,
      okCount: dto.ok_count,
      trendLabel: `${dto.last_hour_defects} dans la dernière heure`,
      trendDirection: dto.last_hour_defects > 0 ? 'up' : 'flat',
    },
    feed: dto.feed.map((f) => ({
      id: f.id,
      label: f.label,
      category: f.category,
      note: f.note ?? undefined,
      productRef: dto.product_id != null ? `#${dto.product_id}` : '',
      ago: timeAgo(f.logged_at, now),
      isOther: f.is_other,
    })),
    visibleCount: dto.feed.length,
    todayCount: dto.today_count,
  };
}
