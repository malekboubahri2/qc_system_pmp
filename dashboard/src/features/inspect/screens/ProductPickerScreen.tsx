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
        <p className="text-ink-muted py-12 text-center">Chargement…</p>
      ) : active.length === 0 ? (
        <p className="text-ink-muted py-12 text-center">
          Aucun produit configuré. Demandez au responsable qualité.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto pt-2">
          {active.map((p) => (
            <button
              key={p.id}
              onClick={() => { setProduct({ id: p.id, name: p.name }); navigate('/pmp'); }}
              className="min-h-[80px] rounded-xl bg-white border border-cream-subtle p-4
                flex items-center gap-3 text-left
                hover:border-accent hover:shadow-card transition-all active:scale-[0.99]"
            >
              <span className="w-11 h-11 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                <Package size={22} />
              </span>
              <span className="font-semibold text-ink text-lg leading-tight">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </InspectScreen>
  );
}
