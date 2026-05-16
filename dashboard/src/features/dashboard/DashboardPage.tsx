import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Users, Layers, Wifi } from 'lucide-react';
import { getSummary } from '@/api/stats';
import { listLogs } from '@/api/logs';
import { listDevices } from '@/api/devices';
import { useOperators } from '@/hooks/useOperators';
import { daysAgo, today } from '@/components/shared/DateRangePicker';
import { Icon } from '@/components/Icon';
import { formatDateTime } from '@/lib/format';

interface StatTileProps {
  label: string;
  value: number | string;
  icon: typeof AlertTriangle;
  color: 'brand' | 'accent' | 'success' | 'info';
}

const COLOR_MAP = {
  brand: { bg: 'bg-brand/10', icon: 'text-brand', value: 'text-brand' },
  accent: { bg: 'bg-accent/10', icon: 'text-accent', value: 'text-accent' },
  success: { bg: 'bg-success/10', icon: 'text-success', value: 'text-success' },
  info: { bg: 'bg-info/10', icon: 'text-info', value: 'text-info' },
} as const;

function StatTile({ label, value, icon, color }: StatTileProps) {
  const c = COLOR_MAP[color];
  return (
    <div
      className="bg-white rounded-lg px-5 py-4 flex items-center gap-4"
      style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}
    >
      <div className={`${c.bg} rounded-lg p-3 flex-shrink-0`}>
        <Icon icon={icon} size={22} className={c.icon} />
      </div>
      <div>
        <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${c.value}`}>{value}</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const todayStr = today();
  const weekStart = daysAgo(6);

  const { data: summary = [] } = useQuery({
    queryKey: ['stats', 'summary', 7],
    queryFn: () => getSummary(7),
  });

  const { data: recentLogs } = useQuery({
    queryKey: ['logs', { from: weekStart, to: todayStr }, 1],
    queryFn: () => listLogs({ from: weekStart, to: todayStr }, 1, 15),
  });

  const { data: operators = [] } = useOperators();

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: listDevices,
    refetchInterval: 10_000,
  });

  const todayCount = summary.find((p) => p.date === todayStr)?.count ?? 0;
  const weekTotal = summary.reduce((s, p) => s + p.count, 0);
  const activeOperators = operators.filter((o) => o.active).length;
  const onlineDevices = devices.filter((d) => d.online).length;

  const logs = recentLogs?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-ink-heading">Tableau de bord</h1>
        <p className="text-sm text-ink-muted mt-1">Vue d'ensemble du système QC</p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Défauts aujourd'hui" value={todayCount} icon={AlertTriangle} color="brand" />
        <StatTile label="Défauts (7 jours)" value={weekTotal} icon={AlertTriangle} color="accent" />
        <StatTile label="Opérateurs actifs" value={activeOperators} icon={Users} color="success" />
        <StatTile label="Appareils en ligne" value={onlineDevices} icon={Wifi} color="info" />
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
        <div className="px-5 py-4 border-b border-cream-subtle flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-heading uppercase tracking-wide">Activité récente</h2>
          <span className="text-xs text-ink-muted">7 derniers jours · 15 entrées</span>
        </div>

        {logs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-ink-muted">
            <Icon icon={Layers} size={28} className="opacity-30" />
            <p className="text-sm">Aucune activité sur les 7 derniers jours.</p>
          </div>
        ) : (
          <ul className="divide-y divide-cream/60">
            {logs.map((log) => (
              <li key={log.id} className="px-5 py-3 flex items-center gap-3 hover:bg-cream/20 transition-colors">
                <span className="font-mono text-xs text-ink-muted w-36 flex-shrink-0 whitespace-nowrap">
                  {formatDateTime(log.logged_at)}
                </span>
                <span className="text-xs text-ink-muted flex-shrink-0 w-28 truncate">{log.operator_name}</span>
                <span className="text-xs text-ink-muted flex-shrink-0 hidden md:block w-28 truncate">{log.category_name}</span>
                <span className="text-sm font-medium text-ink truncate">{log.defect_label}</span>
                {log.product_ref && (
                  <span className="ml-auto font-mono text-xs text-ink-muted flex-shrink-0">{log.product_ref}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
