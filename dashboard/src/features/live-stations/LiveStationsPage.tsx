import { PageHeader, MetaPill } from '@/components/ui';
import { useLiveStations } from './useLiveStations';
import { StationPanel } from './StationPanel';

export function LiveStationsPage() {
  const { stations, updatedAt } = useLiveStations();

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Qualité' }, { label: 'Stations en direct' }]}
        title="Stations en direct"
        subtitle="Activité en temps réel — deux postes d'inspection"
        right={
          <MetaPill>
            Mis à jour <span className="mono">à {updatedAt}</span>
          </MetaPill>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stations.map((station) => (
          <StationPanel key={station.id} station={station} />
        ))}
      </div>
    </>
  );
}
