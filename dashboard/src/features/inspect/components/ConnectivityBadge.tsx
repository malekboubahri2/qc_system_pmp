import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useOffline } from '../offline/OfflineContext';

// Always-visible connection status for the operator (required on every screen).
export function ConnectivityBadge() {
  const { online, pending, syncing } = useOffline();
  return (
    <div className="flex items-center gap-2 text-sm">
      {pending > 0 && (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/15 text-warning font-medium">
          {syncing && <RefreshCw size={14} className="animate-spin" />}
          {pending}<span className="hidden sm:inline">&nbsp;en attente</span>
        </span>
      )}
      <span
        className={[
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium',
          online ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
        ].join(' ')}
      >
        {online ? <Wifi size={14} /> : <WifiOff size={14} />}
        <span className="hidden sm:inline">{online ? 'En ligne' : 'Hors ligne'}</span>
      </span>
    </div>
  );
}
