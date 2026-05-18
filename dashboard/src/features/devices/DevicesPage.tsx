import { useQuery } from '@tanstack/react-query';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { listDevices } from '@/api/devices';
import { Icon } from '@/components/Icon';
import { formatDateTime } from '@/lib/format';

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-block w-2 h-2 rounded-full ${online ? 'bg-success' : 'bg-ink-muted/30'}`}
      />
      <span className={online ? 'text-success font-medium' : 'text-ink-muted'}>
        {online ? 'En ligne' : 'Hors ligne'}
      </span>
    </span>
  );
}

export function DevicesPage() {
  const { data: devices = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['devices'],
    queryFn: listDevices,
    refetchInterval: 10_000,
  });

  const onlineCount = devices.filter((d) => d.online).length;

  const lastRefresh = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-heading">Appareils</h1>
          <p className="text-base text-ink-muted mt-1.5">
            {devices.length > 0
              ? `${onlineCount} / ${devices.length} en ligne`
              : 'Aucun appareil enregistré'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Icon icon={RefreshCw} size={13} />
          Actualisation auto · {lastRefresh}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
        {isLoading ? (
          <div className="flex items-center gap-3 justify-center py-12 text-ink-muted">
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            Chargement…
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-16">
            <Icon icon={WifiOff} size={32} className="mx-auto text-ink-muted/40 mb-3" />
            <p className="text-ink-muted">Aucun appareil n'a encore contacté le serveur.</p>
            <p className="text-xs text-ink-muted mt-1">
              Les terminaux STM32 apparaissent ici dès leur première connexion MQTT.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <th className="px-5 py-4 text-left">Identifiant</th>
                <th className="px-5 py-4 text-left">Statut</th>
                <th className="px-5 py-4 text-left">Dernière connexion</th>
                <th className="px-5 py-4 text-left">Version config</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device, i) => (
                <tr key={device.id} className={i % 2 === 0 ? 'bg-white' : 'bg-cream/30'}>
                  <td className="px-5 py-4 font-mono text-sm text-ink">
                    <span className="flex items-center gap-2">
                      <Icon icon={device.online ? Wifi : WifiOff} size={15} className={device.online ? 'text-success' : 'text-ink-muted/40'} />
                      {device.id}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm">
                    <OnlineDot online={device.online} />
                  </td>
                  <td className="px-5 py-4 font-mono text-sm text-ink-muted">
                    {device.last_seen ? formatDateTime(device.last_seen) : '—'}
                  </td>
                  <td className="px-5 py-4 font-mono text-sm text-ink">
                    {device.config_version != null ? `v${device.config_version}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-ink-muted text-center">
        Un appareil est considéré en ligne s'il a envoyé un heartbeat dans les 90 dernières secondes.
      </p>
    </div>
  );
}
