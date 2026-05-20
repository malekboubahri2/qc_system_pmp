import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { listLogs, downloadCsv } from '@/api/logs';
import { useOperators } from '@/hooks/useOperators';
import { useProducts } from '@/hooks/useProducts';
import { DateRangePicker, daysAgo, today } from '@/components/shared/DateRangePicker';
import { Button } from '@/components/shared/Button';
import { Icon } from '@/components/Icon';
import { formatDateTime } from '@/lib/format';
import type { LogFilters } from '@/api/logs';
import { PageHeader, EmptyState } from '@/components/ui';

const PAGE_SIZE = 50;

export function LogsPage() {
  const [filters, setFilters] = useState<LogFilters>({ from: daysAgo(7), to: today() });
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const { data: result, isLoading } = useQuery({
    queryKey: ['logs', filters, page],
    queryFn: () => listLogs(filters, page, PAGE_SIZE),
  });

  const { data: operators = [] } = useOperators();
  const { data: products = [] } = useProducts();

  const setFilter = useCallback(<K extends keyof LogFilters>(k: K, v: LogFilters[K]) => {
    setFilters((prev) => ({ ...prev, [k]: v || undefined }));
    setPage(1);
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadCsv(filters);
    } catch {
      toast.error('Échec de l\'export');
    } finally {
      setExporting(false);
    }
  }

  const logs = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        breadcrumb={[{ label: 'Journaux' }]}
        title="Journaux"
        subtitle={total > 0 ? `${total} entrée${total > 1 ? 's' : ''}` : 'Aucune entrée'}
        right={
          <Button variant="secondary" onClick={handleExport} loading={exporting}>
            <Icon icon={Download} size={15} />
            Exporter CSV
          </Button>
        }
      />

      {/* Filters bar */}
      <div className="bg-cream-subtle/60 rounded-lg px-5 py-5 flex flex-wrap items-end gap-4">
        <DateRangePicker
          from={filters.from ?? ''}
          to={filters.to ?? ''}
          onFromChange={(v) => setFilter('from', v)}
          onToChange={(v) => setFilter('to', v)}
        />

        {/* Operator filter */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-ink-muted">Opérateur</label>
          <select
            className="bg-white border border-cream-subtle rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
            value={filters.operator_id ?? ''}
            onChange={(e) => setFilter('operator_id', e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Tous</option>
            {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        {/* Product filter */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-ink-muted">Produit</label>
          <select
            className="bg-white border border-cream-subtle rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
            value={filters.product_id ?? ''}
            onChange={(e) => setFilter('product_id', e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Tous</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
        {isLoading ? (
          <div className="flex items-center gap-3 justify-center py-12 text-ink-muted">
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            Chargement…
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Aucun résultat"
            description="Aucun journal pour les critères sélectionnés."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <th className="px-4 py-4 text-left">Date / Heure</th>
                <th className="px-4 py-4 text-left">Opérateur</th>
                <th className="px-4 py-4 text-left">Produit</th>
                <th className="px-4 py-4 text-left">Défaut</th>
                <th className="px-4 py-4 text-left">Note</th>
                <th className="px-4 py-4 text-left">Appareil</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id} className={i % 2 === 0 ? 'bg-white' : 'bg-cream/30'}>
                  <td className="px-4 py-4 font-mono text-sm text-ink-muted whitespace-nowrap">
                    {formatDateTime(log.logged_at)}
                  </td>
                  <td className="px-4 py-4 text-sm text-ink">{log.operator.name}</td>
                  <td className="px-4 py-4 text-sm text-ink-muted">{log.product.name}</td>
                  <td className="px-4 py-4 text-sm font-medium text-ink">{log.defect_type?.label ?? 'OK'}</td>
                  <td className="px-4 py-4 text-sm text-ink-muted">{log.note ?? '—'}</td>
                  <td className="px-4 py-4 font-mono text-sm text-ink-muted">{log.device_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-ink-muted">Page {page} sur {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <Icon icon={ChevronLeft} size={15} />
              Précédent
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Suivant
              <Icon icon={ChevronRight} size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
