import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ChevronLeft, AlertTriangle, ArrowRight } from 'lucide-react';
import { useDefectTypes, useCategoryConstants } from '@/hooks/useProducts';
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
  const { data: categories = [] } = useCategoryConstants();
  const submit = useSubmitInspection();
  const [done, setDone] = useState(false);
  // staleTime 0 so each saved part shows up-to-date numbers, not a cached snapshot.
  const kpi = useQuery({ queryKey: ['kpi'], queryFn: () => getKpi(), enabled: done, staleTime: 0 });

  if (!product) return <Navigate to="/" replace />;

  const labelFor = (kind: string) => categories.find((c) => c.kind === kind)?.display_name ?? kind;
  const pmpSel = types.filter((t) => pmp.includes(t.id));
  const injSel = types.filter((t) => inj.includes(t.id));
  const total = pmp.length + inj.length;
  const conform = total === 0;

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
      <InspectScreen
        fill
        footer={
          <TouchButton block onClick={nextPart} className="max-w-md mx-auto">
            Pièce suivante <ArrowRight size={22} />
          </TouchButton>
        }
      >
        <div className="h-full flex flex-col items-center justify-center gap-[clamp(1.5rem,4vh,3rem)] text-center px-4">
          <div className="flex flex-col items-center gap-4 animate-scale-in">
            <CheckCircle2 size={88} className="text-success" strokeWidth={1.75} />
            <p className="text-fluid-2xl font-bold text-brand">Pièce enregistrée</p>
          </div>
          <div className="bg-white rounded-3xl border border-cream-subtle shadow-card px-[clamp(2rem,8vw,5rem)] py-[clamp(1.5rem,4vh,2.5rem)] animate-fade-in-up">
            <div className="text-fluid-sm uppercase tracking-wider text-ink-muted">Votre taux NC du jour</div>
            <div className="text-fluid-display font-bold text-brand tabular-nums mt-1">
              {kpi.isError ? '—' : rate === null ? '…' : `${rate}%`}
            </div>
            {kpi.data && (
              <div className="text-fluid-base text-ink-muted mt-2">
                {kpi.data.nc_parts} NC sur {kpi.data.inspected_parts} pièces inspectées
              </div>
            )}
          </div>
        </div>
      </InspectScreen>
    );
  }

  // ── Review ────────────────────────────────────────────────────────────────
  return (
    <InspectScreen
      fill
      title="Vérification"
      subtitle={product.name}
      footer={
        <div className="flex gap-3 max-w-2xl mx-auto w-full">
          <TouchButton variant="secondary" onClick={() => navigate('/inj')} className="flex-1">
            <ChevronLeft size={20} /> Modifier
          </TouchButton>
          <TouchButton onClick={onSave} disabled={submit.isPending} className="flex-[2]">
            {submit.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </TouchButton>
        </div>
      }
    >
      <div className="h-full flex flex-col items-center justify-center">
        {conform ? (
          <div className="flex flex-col items-center gap-4 text-center animate-scale-in">
            <CheckCircle2 size={96} className="text-success" strokeWidth={1.75} />
            <p className="text-fluid-2xl font-bold text-brand">Pièce conforme</p>
            <p className="text-fluid-base text-ink-muted">Aucun défaut signalé.</p>
          </div>
        ) : (
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-cream-subtle shadow-card p-[clamp(1.25rem,4vw,2rem)] animate-fade-in-up">
            <div className="flex items-center gap-2.5 text-warning font-semibold text-fluid-lg mb-5">
              <AlertTriangle size={22} />
              {total} défaut{total > 1 ? 's' : ''} signalé{total > 1 ? 's' : ''}
            </div>

            {[{ sel: pmpSel, kind: 'PMP' }, { sel: injSel, kind: 'INJECTION' }]
              .filter((g) => g.sel.length > 0)
              .map((g) => (
                <div key={g.kind} className="mb-4 last:mb-0">
                  <div className="text-fluid-sm uppercase tracking-wider text-ink-muted mb-2">
                    {labelFor(g.kind)}
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {g.sel.map((t: DefectType) => (
                      <li
                        key={t.id}
                        className="px-4 py-2 rounded-full bg-brand/10 text-brand text-fluid-base font-medium"
                      >
                        {t.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

            {note.trim() && (
              <p className="mt-4 pt-4 border-t border-cream-subtle text-fluid-base text-ink-muted">
                <span className="font-semibold text-ink-head">Précision : </span>{note}
              </p>
            )}
          </div>
        )}
      </div>
    </InspectScreen>
  );
}
