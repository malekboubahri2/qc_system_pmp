import type { StationView } from './types';

// Stub hook — returns hard-coded fixture data matching Frame 1.
// TODO Phase 4: replace with useQuery polling GET /api/devices/live.
export function useLiveStations(): { stations: StationView[]; updatedAt: string } {
  const updatedAt = new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return { stations: STUB_STATIONS, updatedAt };
}

const STUB_STATIONS: StationView[] = [
  {
    id: 'qc-stm32-pilot01',
    name: 'Station 1',
    deviceId: 'qc-stm32-pilot01',
    online: true,
    connSince: 'il y a 4s',
    sessionActive: true,
    session: {
      operatorInitial: 'A',
      operatorName: 'Aïcha',
      connectedAt: '07:42',
      productName: 'Capot moteur',
      productRef: 'PROD-001',
      defectCount: 12,
      trendLabel: '3 dans la dernière heure',
      trendDirection: 'up',
    },
    feed: [
      { id: 1, label: 'Cratère',          category: 'PMP Défauts',       productRef: 'PROD-001', ago: 'il y a 12s' },
      { id: 2, label: 'Bullage',           category: 'PMP Défauts',       productRef: 'PROD-001', ago: 'il y a 1 min', repeatCount: 3 },
      { id: 3, label: 'Coulure',           category: 'PMP Défauts',       productRef: 'PROD-001', ago: 'il y a 4 min' },
      { id: 4, label: "Autre — préciser",  category: 'Saisie libre',      productRef: 'PROD-001', ago: 'il y a 7 min', isOther: true, note: 'Marque inhabituelle près du rebord' },
      { id: 5, label: 'Retassure',         category: 'Injection Défauts', productRef: 'PROD-001', ago: 'il y a 14 min' },
      { id: 6, label: 'Sous-épaisseur',    category: 'PMP Défauts',       productRef: 'PROD-001', ago: 'il y a 22 min' },
    ],
    visibleCount: 6,
    todayCount: 12,
  },
  {
    id: 'qc-stm32-pilot02',
    name: 'Station 2',
    deviceId: 'qc-stm32-pilot02',
    online: true,
    connSince: 'il y a 2s',
    sessionActive: true,
    session: {
      operatorInitial: 'M',
      operatorName: 'Mohammed',
      connectedAt: '08:05',
      productName: 'Boîtier cosmétique',
      productRef: 'PROD-003',
      defectCount: 8,
      trendLabel: '1 dans la dernière heure',
      trendDirection: 'up',
    },
    feed: [
      { id: 7,  label: 'Bavure',               category: 'Injection Défauts', productRef: 'PROD-003', ago: 'il y a 34s' },
      { id: 8,  label: 'Reflet irrégulier',    category: 'PMP Défauts',       productRef: 'PROD-003', ago: 'il y a 6 min' },
      { id: 9,  label: 'Pli',                  category: 'Injection Défauts', productRef: 'PROD-003', ago: 'il y a 18 min' },
      { id: 10, label: "Manque d'adhérence",   category: 'PMP Défauts',       productRef: 'PROD-003', ago: 'il y a 26 min' },
      { id: 11, label: 'Trace de moule',       category: 'Injection Défauts', productRef: 'PROD-003', ago: 'il y a 41 min' },
    ],
    visibleCount: 5,
    todayCount: 8,
  },
];
