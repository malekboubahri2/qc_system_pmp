import { useNavigate, Navigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { useDefectTypes, useCategoryConstants } from '@/hooks/useProducts';
import type { DefectType } from '@/types';
import { useInspectionFlow, type Category } from '../flow/InspectionFlowContext';
import { InspectScreen } from '../components/InspectScreen';
import { TouchButton } from '../components/TouchButton';

function sortTypes(types: DefectType[]): DefectType[] {
  return [...types].sort(
    (a, b) =>
      Number(a.is_other_fallback) - Number(b.is_other_fallback) ||
      a.display_order - b.display_order ||
      a.id - b.id,
  );
}

export function DefectGridScreen() {
  const navigate = useNavigate();
  const { operator, product, pmp, inj, toggleDefect, isSelected } = useInspectionFlow();
  const { data: types = [], isLoading } = useDefectTypes(product?.id ?? 0);
  const { data: categories = [] } = useCategoryConstants();

  if (!operator) return <Navigate to="/" replace />;
  if (!product) return <Navigate to="/product" replace />;

  const labelFor = (kind: string) =>
    categories.find((c) => c.kind === kind)?.display_name ?? kind;

  const pmpTypes = sortTypes(types.filter((t) => t.category_kind === 'PMP' && t.active));
  const injTypes = sortTypes(types.filter((t) => t.category_kind === 'INJECTION' && t.active));
  const totalSelected = pmp.length + inj.length;

  return (
    <InspectScreen
      title={product.name}
      subtitle={`Opérateur : ${operator.name}`}
      action={
        <TouchButton variant="ghost" onClick={() => navigate('/product')}>
          <ChevronLeft size={18} /> Produit
        </TouchButton>
      }
      footer={
        <TouchButton block onClick={() => navigate('/summary')}>
          {totalSelected === 0 ? 'Pièce conforme' : `Valider la pièce — ${totalSelected} défaut${totalSelected > 1 ? 's' : ''}`}
          <ArrowRight size={20} />
        </TouchButton>
      }
    >
      {isLoading ? (
        <p className="text-ink-muted py-12 text-center">Chargement…</p>
      ) : (
        <div className="flex flex-col gap-6 max-w-3xl mx-auto">
          <CategorySection
            title={labelFor('PMP')}
            category="PMP"
            types={pmpTypes}
            isSelected={isSelected}
            onToggle={toggleDefect}
          />
          <CategorySection
            title={labelFor('INJECTION')}
            category="INJECTION"
            types={injTypes}
            isSelected={isSelected}
            onToggle={toggleDefect}
          />
        </div>
      )}
    </InspectScreen>
  );
}

function CategorySection({
  title, category, types, isSelected, onToggle,
}: {
  title: string;
  category: Category;
  types: DefectType[];
  isSelected: (c: Category, id: number) => boolean;
  onToggle: (c: Category, id: number) => void;
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">
        {title}
      </h2>
      {types.length === 0 ? (
        <p className="text-sm text-ink-muted py-4">Aucun défaut configuré.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {types.map((t) => {
            const selected = isSelected(category, t.id);
            return (
              <button
                key={t.id}
                onClick={() => onToggle(category, t.id)}
                aria-pressed={selected}
                className={[
                  'min-h-[72px] rounded-xl p-3 text-center font-semibold leading-tight',
                  'border transition-all active:scale-[0.98]',
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
    </section>
  );
}
