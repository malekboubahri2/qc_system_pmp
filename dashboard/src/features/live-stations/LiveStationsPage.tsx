import { Monitor } from 'lucide-react';
import { PageHeader, MetaPill, EmptyState } from '@/components/ui';
import { useLiveStations } from './useLiveStations';
import { StationPanel } from './StationPanel';

export function LiveStationsPage() {
  const { stations, updatedAt, isLoading, isError } = useLiveStations();

  const count = stations.length;
  const subtitle = isLoading
    ? 'Chargement…'
    : `Activité en temps réel — ${count} poste${count > 1 ? 's' : ''} d'inspection`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        breadcrumb={[{ label: 'Qualité' }, { label: 'Stations en direct' }]}
        title="Stations en direct"
        subtitle={subtitle}
        right={
          <MetaPill>
            Mis à jour <span className="mono">à {updatedAt}</span>
          </MetaPill>
        }
      />

      {!isLoading && count === 0 ? (
        <EmptyState
          icon={Monitor}
          title={isError ? 'Stations indisponibles' : 'Aucune station active'}
          description={
            isError
              ? 'Impossible de joindre le serveur. Nouvelle tentative en cours…'
              : "Aucun appareil ne s'est connecté. Les stations apparaîtront ici dès leur première activité."
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stations.map((station) => (
            <StationPanel key={station.id} station={station} />
          ))}
        </div>
      )}
    </div>
  );
}
