import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ChevronLeft, AlertTriangle } from 'lucide-react';
import { useDefectTypes } from '@/hooks/useProducts';
import { getKpi } from '@/api/kpi';
import type { DefectType } from '@/types';
import { useInspectionFlow } from '../flow/InspectionFlowContext';
import { useSubmitInspection } from '../flow/useSubmitInspection';
import { InspectScreen } from '../components/InspectScreen';
import { TouchButton } from '../components/TouchButton';

export function SummaryScreen() {
  const navigate = useNavigate();
  const { product, pmp, inj, note, resetPart } = useInspectionFlow();
  const { data: types = [] } = useDefectTypes(product?.id ?? 0);
  const submit = useSubmitInspection();
  const [done, setDone] = useState(false);
  const kpi = useQuery({ queryKey: ['kpi'], queryFn: () => getKpi(), enabled: done });

  if (!product) return <Navigate to="/" replace />;

  const selectedIds = [...pmp, ...inj];
  const selected = types.filter((t) => selectedIds.includes(t.id));
  const conform = selectedIds.length === 0;

  async function onSave() {
    try {
      const res = await submit.mutateAsync({
        product_id: product!.id,
        pmp_defect_type_ids: pmp,
        inj_defect_type_ids: inj,
        note: note.trim() ? note.trim() : null,
      });
      toast.success(res.queued ? 'Enregistrée hors ligne' : 'Pièce enregistrée');
      setDone(true);
    } catch {
      toast.error('Échec de l’enregistrement — réessayez');
    }
  }

  function nextPart() {
    resetPart();
    setDone(false);
    navigate('/pmp');
  }

  // ── Confirmation with the live Taux NC indicator ──────────────────────────
  if (done) {
    const rate = kpi.data ? Math.round(kpi.data.nc_rate * 100) : null;
    return (
      <InspectScreen title="Enregistré" fill>
        <div className="h-full flex flex-col items-center justify-center gap-6 text-center">
          <CheckCircle2 size={72} className="text-success" />
          <p className="text-2xl font-semibold text-brand">Pièce enregistrée</p>
          <div className="bg-white rounded-2xl border border-cream-subtle px-12 py-6">
            <div className="text-xs uppercase tracking-wider text-ink-muted">Taux NC du jour</div>
            <div className="text-6xl font-bold text-brand tabular-nums mt-1">
              {kpi.isError ? '—' : rate === null ? '…' : `${rate}%`}
            </div>
            {kpi.data && (
              <div className="text-sm text-ink-muted mt-2">
                {kpi.data.nc_parts} NC / {kpi.data.inspected_parts} pièces
              </div>
            )}
          </div>
          <TouchButton onClick={nextPart} className="px-12">Pièce suivante</TouchButton>
        </div>
      </InspectScreen>
    );
  }

  // ── Review ────────────────────────────────────────────────────────────────
  return (
    <InspectScreen
      title="Vérification"
      subtitle={product.name}
      action={
        <TouchButton variant="ghost" onClick={() => navigate('/inj')}>
          <ChevronLeft size={18} /> Modifier
        </TouchButton>
      }
      footer={
        <TouchButton block onClick={onSave} disabled={submit.isPending}>
          {submit.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </TouchButton>
      }
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-5 py-2">
        {conform ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 size={56} className="text-success" />
            <p className="text-xl font-semibold text-brand">Pièce conforme</p>
            <p className="text-ink-muted">Aucun défaut signalé.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-cream-subtle p-4">
            <div className="flex items-center gap-2 text-warning font-semibold mb-3">
              <AlertTriangle size={18} />
              {selected.length} défaut{selected.length > 1 ? 's' : ''} signalé
              {selected.length > 1 ? 's' : ''}
            </div>
            <ul className="flex flex-wrap gap-2">
              {selected.map((t: DefectType) => (
                <li
                  key={t.id}
                  className="px-3 py-1.5 rounded-full bg-brand/10 text-brand text-sm font-medium"
                >
                  {t.label}
                </li>
              ))}
            </ul>
            {note.trim() && (
              <p className="mt-3 text-sm text-ink-muted">
                <span className="font-medium text-ink-head">Précision :</span> {note}
              </p>
            )}
          </div>
        )}
      </div>
    </InspectScreen>
  );
}
