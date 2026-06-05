import { useNavigate } from 'react-router-dom';
import { Package, LogOut } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useInspectionFlow } from '../flow/InspectionFlowContext';
import { useInspectSession, logoutToLogin } from '../session';
import { InspectScreen } from '../components/InspectScreen';
import { TouchButton } from '../components/TouchButton';

export function ProductPickerScreen() {
  const navigate = useNavigate();
  const { setProduct } = useInspectionFlow();
  const { data: me } = useInspectSession();
  const { data: products = [], isLoading } = useProducts();

  const active = products.filter((p) => p.active);

  return (
    <InspectScreen
      title="Quel produit ?"
      subtitle={me?.operator_name ? `Opérateur : ${me.operator_name}` : undefined}
      action={
        <TouchButton variant="ghost" onClick={logoutToLogin}>
          <LogOut size={18} /> Quitter
        </TouchButton>
      }
    >
      {isLoading ? (
        <p className="text-ink-muted py-12 text-center text-fluid-base">Chargement…</p>
      ) : active.length === 0 ? (
        <p className="text-ink-muted py-12 text-center text-fluid-base">
          Aucun produit configuré. Demandez au responsable qualité.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[clamp(0.75rem,2vw,1.25rem)] max-w-3xl mx-auto pt-2">
          {active.map((p, i) => (
            <button
              key={p.id}
              onClick={() => { setProduct({ id: p.id, name: p.name }); navigate('/pmp'); }}
              style={{ ['--stagger' as string]: `${Math.min(i, 8) * 40}ms` }}
              className="stagger-item min-h-[clamp(80px,14vh,108px)] rounded-2xl bg-white border-2 border-cream-subtle
                p-[clamp(1rem,3vw,1.5rem)] flex items-center gap-4 text-left
                hover:border-accent hover:shadow-elevated transition-all duration-150 active:scale-[0.98]"
            >
              <span className="w-[clamp(2.75rem,7vw,3.5rem)] h-[clamp(2.75rem,7vw,3.5rem)] rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                <Package size={26} />
              </span>
              <span className="font-semibold text-ink text-fluid-lg leading-tight">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </InspectScreen>
  );
}
