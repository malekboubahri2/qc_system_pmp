import { useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, ChevronLeft, AlertTriangle } from 'lucide-react';
import { useDefectTypes } from '@/hooks/useProducts';
import type { DefectType } from '@/types';
import { useInspectionFlow } from '../flow/InspectionFlowContext';
import { useSubmitInspection } from '../flow/useSubmitInspection';
import { InspectScreen } from '../components/InspectScreen';
import { TouchButton } from '../components/TouchButton';

export function SummaryScreen() {
  const navigate = useNavigate();
  const { operator, product, pmp, inj, note, setNote, resetPart } = useInspectionFlow();
  const { data: types = [] } = useDefectTypes(product?.id ?? 0);
  const submit = useSubmitInspection();

  if (!operator) return <Navigate to="/" replace />;
  if (!product) return <Navigate to="/product" replace />;

  const selectedIds = [...pmp, ...inj];
  const selected = types.filter((t) => selectedIds.includes(t.id));
  const needsNote = selected.some((t) => t.is_other_fallback);
  const conform = selectedIds.length === 0;

  async function onSave() {
    try {
      const res = await submit.mutateAsync({
        operator_id: operator!.id,
        product_id: product!.id,
        pmp_defect_type_ids: pmp,
        inj_defect_type_ids: inj,
        note: note.trim() ? note.trim() : null,
      });
      toast.success(
        res.queued
          ? 'Enregistrée hors ligne — synchronisation à la reconnexion'
          : conform ? 'Pièce conforme enregistrée' : 'Pièce enregistrée',
      );
      resetPart();
      navigate('/inspect');
    } catch {
      toast.error('Échec de l’enregistrement — réessayez');
    }
  }

  return (
    <InspectScreen
      title="Vérification"
      subtitle={`${product.name} · ${operator.name}`}
      action={
        <TouchButton variant="ghost" onClick={() => navigate('/inspect')}>
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
          </div>
        )}

        {needsNote && (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-head">
            Précision (défaut « Autre »)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={140}
              rows={2}
              placeholder="Décrivez le défaut…"
              className="bg-white border border-cream-subtle rounded-lg px-3 py-2.5 text-base resize-none
                focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </label>
        )}
      </div>
    </InspectScreen>
  );
}
