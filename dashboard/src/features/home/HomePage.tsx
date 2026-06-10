import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHourlyReport } from '@/api/inspection-logs';
import { getKpi } from '@/api/kpi';
import { PageHeader, Section } from '@/components/ui';
import { GlobalStatsRow } from './GlobalStatsRow';
import { DayStatsRow } from './DayStatsRow';
import { HourlyReportTable } from './HourlyReportTable';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HomePage() {
  const [date, setDate] = useState<string>(todayIso);

  const { data, isLoading } = useQuery({
    queryKey: ['inspection-logs', 'hourly', date],
    queryFn: () => getHourlyReport(date),
  });

  // Global, part-level KPIs (correct NC rate by part; the per-category rows
  // can't give a global rate without double-counting parts NC in both).
  const { data: kpi } = useQuery({
    queryKey: ['kpi', date],
    queryFn: () => getKpi({ date }),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <PageHeader
          breadcrumb={[{ label: 'Tableau de bord' }]}
          title="Tableau de bord"
          subtitle="Taux de non-conformité par heure"
        />
        <div className="flex items-center gap-2 pb-1">
          <label htmlFor="report-date" className="text-sm text-ink-muted whitespace-nowrap">
            Date
          </label>
          <input
            id="report-date"
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-cream-sub bg-white px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-ink-muted">Chargement…</div>
      ) : (
        <>
          <GlobalStatsRow kpi={kpi} rows={rows} />

          <DayStatsRow rows={rows} />

          <Section className="overflow-hidden p-0">
            <div className="px-6 py-5 border-b border-cream-sub flex items-center justify-between">
              <h2 className="text-xl font-semibold text-ink-head">Rapport horaire</h2>
              <span className="text-sm text-ink-muted mono">{date}</span>
            </div>
            <div className="p-4">
              <HourlyReportTable rows={rows} />
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
