import { cn } from '@/lib/utils';
import type { HourlyRow } from '@/types';
import { RateCell } from './RateCell';

interface HourlyReportTableProps {
  rows: HourlyRow[];
}

const TH = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <th
    className={cn(
      'px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-ink-muted text-right whitespace-nowrap',
      className,
    )}
  >
    {children}
  </th>
);

const TD = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn('px-3 py-2 text-sm text-right tabular-nums', className)}>
    {children}
  </td>
);

export function HourlyReportTable({ rows }: HourlyReportTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          {/* Category header row */}
          <tr className="border-b border-cream-sub">
            <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-ink-muted text-left w-14">
              Heure
            </th>
            <th
              colSpan={3}
              className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand text-center border-l border-cream-sub"
            >
              PMP Défauts
            </th>
            <th
              colSpan={3}
              className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand text-center border-l border-cream-sub"
            >
              Injection Défauts
            </th>
          </tr>
          {/* Column label row */}
          <tr className="border-b-2 border-cream-sub bg-cream/30">
            <th className="px-3 py-2 w-14" />
            <TH className="border-l border-cream-sub">Total</TH>
            <TH>Défauts</TH>
            <TH>Taux NC</TH>
            <TH className="border-l border-cream-sub">Total</TH>
            <TH>Défauts</TH>
            <TH>Taux NC</TH>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const hasData = row.pmp_total > 0 || row.inj_total > 0;
            return (
              <tr
                key={row.hour}
                className={cn(
                  'border-b border-cream/60 transition-colors hover:bg-cream/20',
                  !hasData && 'opacity-40',
                )}
              >
                <td className="px-3 py-2 text-sm font-mono text-ink-muted font-medium">
                  {String(row.hour).padStart(2, '0')}h
                </td>
                <TD className="border-l border-cream/60">{row.pmp_total || '—'}</TD>
                <TD>{row.pmp_defects || (row.pmp_total > 0 ? '0' : '—')}</TD>
                <TD>
                  <RateCell rate={row.pmp_rate} total={row.pmp_total} />
                </TD>
                <TD className="border-l border-cream/60">{row.inj_total || '—'}</TD>
                <TD>{row.inj_defects || (row.inj_total > 0 ? '0' : '—')}</TD>
                <TD>
                  <RateCell rate={row.inj_rate} total={row.inj_total} />
                </TD>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
