import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, Check, BookOpen } from 'lucide-react';
import { useDefectTypes, useCategoryConstants } from '@/hooks/useProducts';
import { CheatsheetViewer } from '@/components/shared/CheatsheetViewer';
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

const CONFIG: Record<Category, { stepN: number; back: string; next: string; cta: string }> = {
  PMP: { stepN: 1, back: '/', next: '/inj', cta: 'Injection' },
  INJECTION: { stepN: 2, back: '/pmp', next: '/summary', cta: 'Vérifier' },
};

export function CategoryPage({ category }: { category: Category }) {
  const navigate = useNavigate();
  const { product, pmp, inj, toggleDefect, isSelected, note, setNote } = useInspectionFlow();
  const { data: types = [], isLoading } = useDefectTypes(product?.id ?? 0);
  const { data: categories = [] } = useCategoryConstants();
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [showFiche, setShowFiche] = useState(false);

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
      subtitle={`${product.name} · étape ${cfg.stepN} / 2`}
      action={
        <div className="flex items-center gap-2">
          {product.hasCheatsheet && (
            <TouchButton variant="ghost" onClick={() => setShowFiche(true)}>
              <BookOpen size={20} /> Fiche
            </TouchButton>
          )}
          <TouchButton variant="ghost" onClick={() => navigate(cfg.back)}>
            <ChevronLeft size={20} /> Retour
          </TouchButton>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-4 max-w-5xl mx-auto w-full">
          <span className="text-fluid-base text-ink-muted">
            {selectedCount === 0
              ? 'Aucun défaut'
              : `${selectedCount} défaut${selectedCount > 1 ? 's' : ''} sélectionné${selectedCount > 1 ? 's' : ''}`}
          </span>
          <TouchButton onClick={() => navigate(cfg.next)} className="px-[clamp(2rem,6vw,3.5rem)]">
            {cfg.cta} <ArrowRight size={22} />
          </TouchButton>
        </div>
      }
    >
      <div className="h-full max-w-5xl mx-auto w-full flex flex-col">
        {/* Two-step progress */}
        <div className="flex gap-2 pt-1 pb-3 shrink-0">
          {[1, 2].map((n) => (
            <div
              key={n}
              className={['h-1.5 flex-1 rounded-full transition-colors',
                n <= cfg.stepN ? 'bg-accent' : 'bg-cream-subtle'].join(' ')}
            />
          ))}
        </div>

        {isLoading ? (
          <p className="text-ink-muted py-12 text-center text-fluid-base">Chargement…</p>
        ) : items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-ink-muted text-fluid-base text-center max-w-sm">
              Aucun défaut configuré pour cette catégorie. Passez à l&apos;étape suivante.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-2 sm:grid-cols-3 gap-[clamp(0.6rem,1.6vw,1rem)] auto-rows-fr">
            {items.map((t, i) => {
              const selected = isSelected(category, t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => onTile(t)}
                  aria-pressed={selected}
                  style={{ ['--stagger' as string]: `${Math.min(i, 8) * 35}ms` }}
                  className={[
                    'stagger-item relative rounded-2xl p-[clamp(0.75rem,2vw,1.25rem)]',
                    'text-center font-semibold text-fluid-lg leading-tight tracking-tight',
                    'border-2 transition-all duration-150 active:scale-[0.97]',
                    'flex items-center justify-center min-h-0',
                    selected
                      ? 'bg-brand text-ink-inverse border-brand shadow-elevated'
                      : 'bg-white text-ink border-cream-subtle hover:border-accent',
                    t.is_other_fallback && !selected ? 'border-dashed text-ink-muted' : '',
                  ].join(' ')}
                >
                  {selected && (
                    <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent text-brand-deep flex items-center justify-center animate-pop-in">
                      <Check size={16} strokeWidth={3} />
                    </span>
                  )}
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

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
      {showFiche && (
        <CheatsheetViewer
          productId={product.id}
          productName={product.name}
          onClose={() => setShowFiche(false)}
        />
      )}
    </InspectScreen>
  );
}
