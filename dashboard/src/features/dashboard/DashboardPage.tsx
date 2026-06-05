import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Users, Layers, Wifi } from 'lucide-react';
import { getSummary } from '@/api/stats';
import { listLogs } from '@/api/logs';
import { listDevices } from '@/api/devices';
import { useOperators } from '@/hooks/useOperators';
import { daysAgo, today } from '@/components/shared/DateRangePicker';
import { Icon } from '@/components/Icon';
import { formatDateTime } from '@/lib/format';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { CountUp } from '@/components/ui/CountUp';

interface StatTileProps {
  label: string;
  value: number;
  icon: typeof AlertTriangle;
  color: 'brand' | 'accent' | 'success' | 'info';
  index?: number;
}

const COLOR_MAP = {
  brand: { bg: 'bg-brand/10', icon: 'text-brand', value: 'text-brand' },
  accent: { bg: 'bg-accent/10', icon: 'text-accent', value: 'text-accent' },
  success: { bg: 'bg-success/10', icon: 'text-success', value: 'text-success' },
  info: { bg: 'bg-info/10', icon: 'text-info', value: 'text-info' },
} as const;

function StatTile({ label, value, icon, color, index = 0 }: StatTileProps) {
  const c = COLOR_MAP[color];
  return (
    <div
      className="stagger-item bg-white rounded-lg px-5 py-5 flex items-center gap-5
        transition-transform duration-200 hover:-translate-y-0.5"
      style={{ ['--stagger' as string]: `${index * 70}ms`, boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}
    >
      <div className={`${c.bg} rounded-lg p-3 flex-shrink-0`}>
        <Icon icon={icon} size={22} className={c.icon} />
      </div>
      <div>
        <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 tabular-nums ${c.value}`}>
          <CountUp value={value} />
        </p>
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
    <div className="flex flex-col gap-8">
      <PageHeader
        breadcrumb={[{ label: 'Tableau de bord' }]}
        title="Tableau de bord"
        subtitle="Vue d'ensemble du système QC"
      />

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile index={0} label="Défauts aujourd'hui" value={todayCount} icon={AlertTriangle} color="brand" />
        <StatTile index={1} label="Défauts (7 jours)" value={weekTotal} icon={AlertTriangle} color="accent" />
        <StatTile index={2} label="Opérateurs actifs" value={activeOperators} icon={Users} color="success" />
        <StatTile index={3} label="Appareils en ligne" value={onlineDevices} icon={Wifi} color="info" />
      </div>

      {/* Recent activity */}
      <Section className="overflow-hidden p-0">
        <div className="px-6 py-5 flex items-center justify-between border-b border-cream-sub">
          <h2 className="text-xl font-semibold text-ink-head">Activité récente</h2>
          <span className="text-sm text-ink-muted">7 derniers jours · 15 entrées</span>
        </div>
        {logs.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Aucune activité"
            description="Aucun défaut enregistré sur les 7 derniers jours."
          />
        ) : (
          <ul className="divide-y divide-cream/60">
            {logs.map((log) => (
              <li key={log.id} className="px-6 py-4 flex items-center gap-3 hover:bg-cream/20 transition-colors">
                <span className="font-mono text-sm text-ink-muted w-40 flex-shrink-0 whitespace-nowrap">
                  {formatDateTime(log.logged_at)}
                </span>
                <span className="text-sm text-ink-muted flex-shrink-0 w-32 truncate">{log.operator.name}</span>
                <span className="text-sm text-ink-muted flex-shrink-0 hidden md:block w-28 truncate">{log.defect_type?.category_kind ?? '—'}</span>
                <span className="text-sm font-medium text-ink truncate">{log.defect_type?.label ?? 'OK'}</span>
                {log.product && (
                  <span className="ml-auto font-mono text-sm text-ink-muted flex-shrink-0">{log.product.name}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
