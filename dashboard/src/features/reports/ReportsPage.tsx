import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, FileText } from 'lucide-react';
import { getQualityReport } from '@/api/reports';
import { config } from '@/config';
import { daysAgo, today } from '@/components/shared/DateRangePicker';
import { PageHeader, EmptyState } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { QualityReport } from '@/types';

function pct(r: number): string {
  return `${(r * 100).toFixed(1).replace('.', ',')} %`;
}
function fdate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

const inputCls =
  'bg-white border border-cream-subtle rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent';

export function ReportsPage() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(today());

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'quality', from, to],
    queryFn: () => getQualityReport(from, to),
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Controls — hidden when printing */}
      <div className="print:hidden flex flex-col gap-4">
        <PageHeader
          breadcrumb={[{ label: 'Rapports' }]}
          title="Rapport qualité"
          subtitle="Synthèse d'une période — imprimable et exportable en PDF"
          right={
            <button
              onClick={() => window.print()}
              disabled={!data || data.inspected_parts === 0}
              className="flex items-center gap-2 bg-brand text-ink-inverse px-4 py-2.5 rounded-lg
                font-medium hover:bg-brand-dark transition-colors disabled:opacity-40"
            >
              <Icon icon={Printer} size={16} /> Imprimer / PDF
            </button>
          }
        />
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm text-ink-muted">Du</label>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          <label className="text-sm text-ink-muted">au</label>
          <input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-ink-muted py-12 text-center">Chargement…</p>
      ) : isError ? (
        <EmptyState icon={FileText} title="Rapport indisponible" description="Impossible de charger les données." />
      ) : data && data.inspected_parts === 0 ? (
        <EmptyState icon={FileText} title="Aucune donnée" description="Aucune pièce inspectée sur cette période." />
      ) : data ? (
        <ReportSheet report={data} />
      ) : null}
    </div>
  );
}

function ReportSheet({ report: r }: { report: QualityReport }) {
  const maxDefect = r.top_defects[0]?.count ?? 1;
  return (
    <div className="report-sheet bg-white rounded-lg px-8 py-8 print:rounded-none print:px-0"
      style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 pb-5 border-b-2 border-brand">
        <div>
          <h1 className="text-2xl font-bold text-brand tracking-tight">Rapport qualité</h1>
          <p className="text-ink-muted mt-1">{config.plantName}</p>
        </div>
        <div className="text-right text-sm text-ink-muted">
          <p className="font-medium text-ink-head">{fdate(r.date_from)} — {fdate(r.date_to)}</p>
          <p className="mt-1">Généré le {new Date(r.generated_at).toLocaleString('fr-FR')}</p>
        </div>
      </div>

      {/* ── KPI summary ── */}
      <section className="break-inside-avoid mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Pièces inspectées" value={r.inspected_parts.toLocaleString('fr-FR')} />
          <Kpi label="Taux NC global" value={pct(r.nc_rate)} accent />
          <Kpi label="Taux NC PMP" value={pct(r.pmp_nc_rate)} />
          <Kpi label="Taux NC Injection" value={pct(r.inj_nc_rate)} />
        </div>
        <p className="text-sm text-ink-muted mt-3">
          {r.nc_parts.toLocaleString('fr-FR')} pièces non conformes · {r.ok_parts.toLocaleString('fr-FR')} conformes ·
          {' '}{r.defects_total.toLocaleString('fr-FR')} défauts au total
        </p>
      </section>

      {/* ── Top defects (Pareto) ── */}
      <section className="break-inside-avoid mt-8">
        <h2 className="text-lg font-semibold text-ink-head mb-3">Défauts les plus fréquents</h2>
        {r.top_defects.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun défaut sur la période.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {r.top_defects.map((d) => (
              <div key={d.label} className="flex items-center gap-3">
                <span className="w-44 text-sm text-ink truncate flex-shrink-0">{d.label}</span>
                <div className="flex-1 bg-cream-subtle rounded h-5 overflow-hidden">
                  <div className="h-full bg-brand rounded"
                    style={{ width: `${Math.max((d.count / maxDefect) * 100, 4)}%` }} />
                </div>
                <span className="w-10 text-right text-sm font-medium text-ink tabular-nums">{d.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── By operator ── */}
      <section className="break-inside-avoid mt-8">
        <h2 className="text-lg font-semibold text-ink-head mb-3">Par opérateur</h2>
        <Table
          head={['Opérateur', 'Pièces', 'NC', 'Taux NC']}
          rows={r.by_operator.map((o) => [o.operator, o.parts.toString(), o.nc_parts.toString(), pct(o.nc_rate)])}
        />
      </section>

      {/* ── Daily trend ── */}
      <section className="break-inside-avoid mt-8">
        <h2 className="text-lg font-semibold text-ink-head mb-3">Évolution journalière</h2>
        <Table
          head={['Date', 'Pièces', 'NC', 'Taux NC']}
          rows={r.daily.map((d) => [fdate(d.date), d.parts.toString(), d.nc_parts.toString(), pct(d.nc_rate)])}
        />
      </section>
    </div>
  );
}

function Kpi({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-cream-subtle px-4 py-4">
      <p className="text-xs uppercase tracking-wider text-ink-muted">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${accent ? 'text-accent' : 'text-brand'}`}>{value}</p>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  if (rows.length === 0) return <p className="text-sm text-ink-muted">Aucune donnée.</p>;
  return (
    <table className="w-full text-sm border border-cream-subtle">
      <thead>
        <tr className="bg-cream-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {head.map((h, i) => (
            <th key={h} className={`px-4 py-2.5 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className={ri % 2 ? 'bg-cream/30' : 'bg-white'}>
            {row.map((cell, ci) => (
              <td key={ci} className={`px-4 py-2 ${ci === 0 ? 'text-left text-ink' : 'text-right tabular-nums text-ink-muted'}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
