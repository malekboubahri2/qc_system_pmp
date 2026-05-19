import type { HourlyRow } from '@/types';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div
      className="bg-white rounded-lg px-5 py-4 flex flex-col gap-1"
      style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}
    >
      <span className="text-xs font-medium uppercase tracking-wider text-ink-muted leading-none">
        {label}
      </span>
      <span className="text-3xl font-bold text-ink-head leading-none tracking-tightest tnum mt-1">
        {value}
      </span>
      {sub && <span className="text-xs text-ink-muted">{sub}</span>}
    </div>
  );
}

interface DayStatsRowProps {
  rows: HourlyRow[];
}

export function DayStatsRow({ rows }: DayStatsRowProps) {
  const pmpTotal    = rows.reduce((s, r) => s + r.pmp_total, 0);
  const pmpDefects  = rows.reduce((s, r) => s + r.pmp_defects, 0);
  const injTotal    = rows.reduce((s, r) => s + r.inj_total, 0);
  const injDefects  = rows.reduce((s, r) => s + r.inj_defects, 0);

  const pmpRate = pmpTotal > 0 ? (pmpDefects / pmpTotal * 100).toFixed(1) + '%' : '—';
  const injRate = injTotal > 0 ? (injDefects / injTotal * 100).toFixed(1) + '%' : '—';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="PMP — Inspections"
        value={pmpTotal}
        sub={`${pmpDefects} défaut${pmpDefects !== 1 ? 's' : ''}`}
      />
      <StatCard
        label="PMP — Taux NC"
        value={pmpRate}
        sub={pmpTotal > 0 ? `sur ${pmpTotal} insp.` : undefined}
      />
      <StatCard
        label="Injection — Inspections"
        value={injTotal}
        sub={`${injDefects} défaut${injDefects !== 1 ? 's' : ''}`}
      />
      <StatCard
        label="Injection — Taux NC"
        value={injRate}
        sub={injTotal > 0 ? `sur ${injTotal} insp.` : undefined}
      />
    </div>
  );
}
