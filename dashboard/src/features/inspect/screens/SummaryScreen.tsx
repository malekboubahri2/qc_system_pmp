import { useNavigate, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ChevronLeft, AlertTriangle } from 'lucide-react';
import { useDefectTypes, useCategoryConstants } from '@/hooks/useProducts';
import { getKpi } from '@/api/kpi';
import type { DefectType } from '@/types';
import { useInspectionFlow } from '../flow/InspectionFlowContext';
import { useSubmitInspection } from '../flow/useSubmitInspection';
import { getDeviceId } from '../device';
import { InspectScreen } from '../components/InspectScreen';
import { TouchButton } from '../components/TouchButton';

// One screen: review the choices, see the running Taux NC, and save → next part.
// (Merges the old review + post-save stats screens to cut a click.)
export function SummaryScreen() {
  const navigate = useNavigate();
  const { product, pmp, inj, note, resetPart } = useInspectionFlow();
  const { data: types = [] } = useDefectTypes(product?.id ?? 0);
  const { data: categories = [] } = useCategoryConstants();
  const submit = useSubmitInspection();

  // The operator's Taux NC for today, computed server-side and scoped to this
  // operator by the token. Robust by design: no dependency on a stored session
  // start or the tablet clock (the old `since`-based session rate broke when the
  // kiosk clock drifted or the stored start was missing → always 0%). Refetched
  // each visit so it tracks the running total.
  const kpi = useQuery({
    queryKey: ['kpi', 'today'],
    queryFn: () => getKpi({}),
    staleTime: 0,
  });

  if (!product) return <Navigate to="/" replace />;

  const labelFor = (kind: string) => categories.find((c) => c.kind === kind)?.display_name ?? kind;
  const pmpSel = types.filter((t) => pmp.includes(t.id));
  const injSel = types.filter((t) => inj.includes(t.id));
  const total = pmp.length + inj.length;
  const conform = total === 0;
  const rate = kpi.data ? Math.round(kpi.data.nc_rate * 100) : null;

  async function onSave() {
    try {
      const res = await submit.mutateAsync({
        device_id: getDeviceId(),
        product_id: product!.id,
        pmp_defect_type_ids: pmp,
        inj_defect_type_ids: inj,
        note: note.trim() ? note.trim() : null,
      });
      toast.success(res.queued ? 'Enregistrée hors ligne' : 'Pièce enregistrée');
      resetPart();
      void kpi.refetch();
      navigate('/pmp');
    } catch {
      toast.error('Échec de l’enregistrement — réessayez');
    }
  }

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
      <div className="h-full flex flex-col items-center justify-center gap-[clamp(1.25rem,3.5vh,2.5rem)]">
        {/* Choices review */}
        {conform ? (
          <div className="flex flex-col items-center gap-3 text-center animate-scale-in">
            <CheckCircle2 size={84} className="text-success" strokeWidth={1.75} />
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

        {/* Running Taux NC — the operator's rate today */}
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-cream-subtle shadow-card px-[clamp(1.25rem,4vw,2rem)] py-3">
          <span className="text-fluid-sm uppercase tracking-wider text-ink-muted">Votre taux NC aujourd’hui</span>
          <span className="text-fluid-xl font-bold text-brand tabular-nums">
            {kpi.isError ? '—' : rate === null ? '…' : `${rate}%`}
          </span>
          {kpi.data && kpi.data.inspected_parts > 0 && (
            <span className="text-fluid-sm text-ink-muted">
              {kpi.data.nc_parts}/{kpi.data.inspected_parts}
            </span>
          )}
        </div>
      </div>
    </InspectScreen>
  );
}
