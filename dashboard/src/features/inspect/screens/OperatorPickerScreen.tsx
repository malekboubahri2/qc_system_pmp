import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, User } from 'lucide-react';
import { useOperators } from '@/hooks/useOperators';
import { verifyPin } from '@/api/operators';
import type { Operator } from '@/types';
import { useStationSession } from '../station-session';
import { useInspectionFlow } from '../flow/InspectionFlowContext';
import { InspectScreen } from '../components/InspectScreen';
import { TouchButton } from '../components/TouchButton';
import { PinPad, PinDots } from '../components/PinPad';

export function OperatorPickerScreen() {
  const navigate = useNavigate();
  const { logout } = useStationSession();
  const { setOperator } = useInspectionFlow();
  const { data: operators = [], isLoading } = useOperators();
  const [picked, setPicked] = useState<Operator | null>(null);

  const eligible = operators.filter((o) => o.active && o.pin_set);

  if (picked) {
    return (
      <PinEntry
        operator={picked}
        onBack={() => setPicked(null)}
        onVerified={() => {
          setOperator({ id: picked.id, name: picked.name });
          navigate('/product');
        }}
      />
    );
  }

  return (
    <InspectScreen
      title="Qui êtes-vous ?"
      subtitle="Sélectionnez votre nom pour commencer"
      action={
        <TouchButton variant="ghost" onClick={logout}>
          <LogOut size={18} /> Poste
        </TouchButton>
      }
    >
      {isLoading ? (
        <p className="text-ink-muted py-12 text-center">Chargement…</p>
      ) : eligible.length === 0 ? (
        <p className="text-ink-muted py-12 text-center">
          Aucun opérateur actif. Demandez au responsable qualité d&apos;en créer un.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
          {eligible.map((op) => (
            <button
              key={op.id}
              onClick={() => setPicked(op)}
              className="min-h-[88px] rounded-xl bg-white border border-cream-subtle p-4
                flex flex-col items-center justify-center gap-2 text-center
                hover:border-accent hover:shadow-card transition-all active:scale-[0.98]"
            >
              <span className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center">
                <User size={20} />
              </span>
              <span className="font-semibold text-ink leading-tight">{op.name}</span>
            </button>
          ))}
        </div>
      )}
    </InspectScreen>
  );
}

function PinEntry({
  operator, onBack, onVerified,
}: {
  operator: Operator;
  onBack: () => void;
  onVerified: () => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(false);
    try {
      const ok = await verifyPin(operator.id, pin);
      if (ok) onVerified();
      else {
        setError(true);
        setPin('');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <InspectScreen
      title={operator.name}
      subtitle="Saisissez votre code PIN"
      action={
        <TouchButton variant="ghost" onClick={onBack}>
          <ArrowLeft size={18} /> Retour
        </TouchButton>
      }
      footer={
        <TouchButton block onClick={submit} disabled={busy || pin.length < 4}>
          {busy ? 'Vérification…' : 'Valider'}
        </TouchButton>
      }
    >
      <div className="max-w-xs mx-auto flex flex-col gap-6 py-6">
        <PinDots length={pin.length} />
        {error && (
          <p className="text-center text-danger text-sm -mt-3">Code PIN incorrect</p>
        )}
        <PinPad value={pin} onChange={setPin} disabled={busy} />
      </div>
    </InspectScreen>
  );
}
