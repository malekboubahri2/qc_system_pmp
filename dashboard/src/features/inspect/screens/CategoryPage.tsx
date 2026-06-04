import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { useDefectTypes, useCategoryConstants } from '@/hooks/useProducts';
import type { DefectType } from '@/types';
import { useInspectionFlow, type Category } from '../flow/InspectionFlowContext';
import { InspectScreen } from '../components/InspectScreen';
import { TouchButton } from '../components/TouchButton';
import { NoteModal } from '../components/NoteModal';

function sortTypes(types: DefectType[]): DefectType[] {
  return [...types].sort(
    (a, b) =>
      Number(a.is_other_fallback) - Number(b.is_other_fallback) ||
      a.display_order - b.display_order ||
      a.id - b.id,
  );
}

const CONFIG: Record<Category, { step: string; back: string; next: string; cta: string }> = {
  PMP: { step: '1 / 2', back: '/', next: '/inj', cta: 'Injection' },
  INJECTION: { step: '2 / 2', back: '/pmp', next: '/summary', cta: 'Vérifier' },
};

export function CategoryPage({ category }: { category: Category }) {
  const navigate = useNavigate();
  const { product, pmp, inj, toggleDefect, isSelected, note, setNote } = useInspectionFlow();
  const { data: types = [], isLoading } = useDefectTypes(product?.id ?? 0);
  const { data: categories = [] } = useCategoryConstants();
  const [noteFor, setNoteFor] = useState<number | null>(null);

  if (!product) return <Navigate to="/" replace />;

  const cfg = CONFIG[category];
  const label = categories.find((c) => c.kind === category)?.display_name ?? category;
  const items = sortTypes(types.filter((t) => t.category_kind === category && t.active));
  const selectedCount = (category === 'PMP' ? pmp : inj).length;

  function onTile(t: DefectType) {
    const selected = isSelected(category, t.id);
    if (t.is_other_fallback && !selected) {
      setNoteFor(t.id);          // instant note popup before selecting
      return;
    }
    if (t.is_other_fallback && selected) {
      toggleDefect(category, t.id);
      setNote('');               // clearing the "Autre" detail
      return;
    }
    toggleDefect(category, t.id);
  }

  return (
    <InspectScreen
      fill
      title={label}
      subtitle={`${product.name} · étape ${cfg.step}`}
      action={
        <TouchButton variant="ghost" onClick={() => navigate(cfg.back)}>
          <ChevronLeft size={18} /> Retour
        </TouchButton>
      }
      footer={
        <div className="flex items-center justify-between gap-4">
          <span className="text-ink-muted">
            {selectedCount === 0 ? 'Aucun défaut' : `${selectedCount} défaut${selectedCount > 1 ? 's' : ''}`}
          </span>
          <TouchButton onClick={() => navigate(cfg.next)} className="px-8">
            {cfg.cta} <ArrowRight size={20} />
          </TouchButton>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-ink-muted py-12 text-center">Chargement…</p>
      ) : items.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-ink-muted">Aucun défaut configuré pour cette catégorie.</p>
        </div>
      ) : (
        <div className="h-full grid grid-cols-2 sm:grid-cols-3 gap-3 auto-rows-fr">
          {items.map((t) => {
            const selected = isSelected(category, t.id);
            return (
              <button
                key={t.id}
                onClick={() => onTile(t)}
                aria-pressed={selected}
                className={[
                  'rounded-2xl p-4 text-center font-semibold text-lg leading-tight',
                  'border-2 transition-all active:scale-[0.98] flex items-center justify-center',
                  selected
                    ? 'bg-brand text-ink-inverse border-brand shadow-card'
                    : 'bg-white text-ink border-cream-subtle hover:border-accent',
                  t.is_other_fallback && !selected ? 'border-dashed text-ink-muted' : '',
                ].join(' ')}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <NoteModal
        open={noteFor !== null}
        initial={note}
        onCancel={() => setNoteFor(null)}
        onConfirm={(text) => {
          if (noteFor !== null) {
            toggleDefect(category, noteFor);
            setNote(text);
          }
          setNoteFor(null);
        }}
      />
    </InspectScreen>
  );
}
