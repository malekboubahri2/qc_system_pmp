import { CheckCircle2, LogOut } from 'lucide-react';
import { config } from '@/config';
import { useStationSession } from '../station-session';
import { InspectScreen } from '../components/InspectScreen';
import { TouchButton } from '../components/TouchButton';

// Placeholder home shown once the station is activated. The inspection flow
// (operator → product → grids → summary) replaces this in the next slice.
export function ReadyScreen() {
  const { logout } = useStationSession();
  return (
    <InspectScreen
      title={config.plantName}
      subtitle="Poste de contrôle qualité"
      action={
        <TouchButton variant="ghost" onClick={logout}>
          <LogOut size={18} /> Déconnecter le poste
        </TouchButton>
      }
    >
      <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-16">
        <CheckCircle2 size={64} className="text-success" />
        <h2 className="text-xl font-semibold text-brand">Poste activé</h2>
        <p className="text-ink-muted max-w-sm">
          Le poste est prêt. Le parcours d&apos;inspection sera disponible ici.
        </p>
      </div>
    </InspectScreen>
  );
}
