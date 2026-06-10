import { Percent, Gauge } from 'lucide-react';
import type { HourlyRow, KpiSnapshot } from '@/types';

// Severity colour for the global NC rate (matches the andon thresholds:
// <=5% good, <=10% moderate, >10% critical). `rate` is a 0..1 fraction.
function ncRateColor(rate: number): string {
  if (rate > 0.1) return 'text-danger';
  if (rate > 0.05) return 'text-warning';
  return 'text-success';
}

interface HeroCardProps {
  icon: typeof Percent;
  iconClass: string;
  label: string;
  value: string;
  valueClass?: string;
  unit?: string;
  sub: string;
}

function HeroCard({ icon: Ic, iconClass, label, value, valueClass, unit, sub }: HeroCardProps) {
  return (
    <div
      className="bg-white rounded-lg p-6 flex items-center gap-5"
      style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}
    >
      <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${iconClass}`}>
        <Ic size={24} />
      </div>
      <div className="min-w-0">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-muted leading-none">
          {label}
        </span>
        <div className="flex items-baseline gap-1.5 mt-2">
          <span className={`text-4xl font-bold leading-none tracking-tightest tnum ${valueClass ?? 'text-ink-head'}`}>
            {value}
          </span>
          {unit && <span className="text-sm font-medium text-ink-muted">{unit}</span>}
        </div>
        <span className="block text-xs text-ink-muted mt-2 truncate">{sub}</span>
      </div>
    </div>
  );
}

interface Props {
  kpi?: KpiSnapshot;
  rows: HourlyRow[];
}

/** Two hero widgets above the per-category breakdown: global Taux NC (left) and
 *  cadence — inspection rate per active hour (right). */
export function GlobalStatsRow({ kpi, rows }: Props) {
  const inspected = kpi?.inspected_parts ?? 0;
  const activeHours = rows.filter((r) => r.pmp_total + r.inj_total > 0).length;
  const cadence = activeHours > 0 ? Math.round(inspected / activeHours) : null;
  const hasData = inspected > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <HeroCard
        icon={Percent}
        iconClass="bg-brand/10 text-brand"
        label="Taux NC global"
        value={hasData && kpi ? `${(kpi.nc_rate * 100).toFixed(1)}%` : '—'}
        valueClass={hasData && kpi ? ncRateColor(kpi.nc_rate) : 'text-ink-head'}
        sub={hasData && kpi ? `${kpi.nc_parts} NC sur ${inspected} pièces` : 'Aucune inspection'}
      />
      <HeroCard
        icon={Gauge}
        iconClass="bg-accent/20 text-brand"
        label="Cadence"
        value={cadence !== null ? `${cadence}` : '—'}
        unit={cadence !== null ? 'pièces/h' : undefined}
        sub={cadence !== null ? `${inspected} pièces · ${activeHours} h actives` : 'Aucune inspection'}
      />
    </div>
  );
}
