import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getSummary, getByDefect, getByOperator, getHeatmap } from '@/api/stats';
import { PageHeader } from '@/components/ui';

const BRAND = '#1A5560';
const ACCENT = '#D4B765';
const CREAM = '#F5E8DC';
const MUTED = '#6B6B6B';

const DAYS_OPTIONS = [
  { label: '7 jours', value: 7 },
  { label: '30 jours', value: 30 },
  { label: '90 jours', value: 90 },
] as const;

function ChartCard({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <div
      data-testid={testId}
      className="bg-white rounded-lg p-6"
      style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08),0 1px 2px rgba(26,85,96,0.04)' }}
    >
      <h2 className="text-sm font-semibold text-ink-head mb-4 uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-ink-muted py-10 text-center">Aucune donnée pour la période</p>;
}

function fmtDate(s: string) {
  const parts = s.split('-');
  return `${parts[2]}/${parts[1]}`;
}

function fmtHour(h: number) {
  return `${String(h).padStart(2, '0')}h`;
}

const tooltipStyle = {
  background: '#fff',
  border: `1px solid ${CREAM}`,
  borderRadius: 8,
  fontSize: 13,
  boxShadow: '0 4px 12px rgba(26,85,96,0.12)',
};

export function AnalyticsPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const { data: summary = [] } = useQuery({
    queryKey: ['stats', 'summary', days],
    queryFn: () => getSummary(days),
  });

  const { data: byDefect = [] } = useQuery({
    queryKey: ['stats', 'byDefect', days],
    queryFn: () => getByDefect(days),
  });

  const { data: byOperator = [] } = useQuery({
    queryKey: ['stats', 'byOperator', days],
    queryFn: () => getByOperator(days),
  });

  const { data: heatmap = [] } = useQuery({
    queryKey: ['stats', 'heatmap', days],
    queryFn: () => getHeatmap(days),
  });

  const topDefects = [...byDefect].sort((a, b) => b.count - a.count).slice(0, 10);

  const hourData = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: heatmap.find((p) => p.hour === h)?.count ?? 0,
  }));

  // For 90-day range, thin out the x-axis ticks
  const dateInterval = days === 7 ? 0 : days === 30 ? 5 : 13;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[{ label: 'Analytiques' }]}
        title="Analytiques"
        subtitle="Tendances et répartition des défauts"
        right={
          <div className="flex gap-1 bg-cream-sub/60 rounded-lg p-1">
            {DAYS_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setDays(o.value)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  days === o.value
                    ? 'bg-white text-brand shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Daily trend — full width */}
      <ChartCard title="Défauts par jour" testId="analytics-chart">
        {summary.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={summary} margin={{ top: 4, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid stroke={CREAM} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fill: MUTED, fontSize: 11 }}
                interval={dateInterval}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: MUTED, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(v) => `Date : ${v}`}
                formatter={(value) => [value, 'Défauts']}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke={BRAND}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: BRAND, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* By defect + By operator — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Top 10 types de défauts">
          {topDefects.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={Math.max(180, topDefects.length * 34)}>
              <BarChart
                data={topDefects}
                layout="vertical"
                margin={{ top: 0, right: 12, bottom: 0, left: 4 }}
              >
                <CartesianGrid stroke={CREAM} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: MUTED, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: MUTED, fontSize: 11 }}
                  width={130}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [value, 'Occurrences']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {topDefects.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? ACCENT : BRAND}
                      fillOpacity={Math.max(0.4, 1 - i * 0.06)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Défauts par opérateur">
          {byOperator.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={Math.max(180, byOperator.length * 40)}>
              <BarChart
                data={byOperator}
                layout="vertical"
                margin={{ top: 0, right: 12, bottom: 0, left: 4 }}
              >
                <CartesianGrid stroke={CREAM} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: MUTED, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: MUTED, fontSize: 11 }}
                  width={110}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [value, 'Défauts logués']}
                />
                <Bar dataKey="count" fill={BRAND} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Hour-of-day distribution */}
      <ChartCard title="Répartition par heure de la journée">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={hourData} margin={{ top: 4, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={CREAM} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="hour"
              tickFormatter={fmtHour}
              tick={{ fill: MUTED, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: MUTED, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(v) => `${fmtHour(Number(v))}`}
              formatter={(value) => [value, 'Défauts']}
            />
            <Bar dataKey="count" fill={BRAND} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
