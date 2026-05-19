import type {
  User, Operator, Product, CategoryConstant, DefectType, DefectLog,
  Device, FeatureFlag, PaginatedLogs,
  SummaryPoint, ByDefectPoint, ByOperatorPoint, HeatmapPoint,
} from '@/types';

export const FIXTURE_USER: User = {
  id: 1,
  email: 'admin@qc.local',
  name: 'Admin',
};

export const FIXTURE_OPERATOR: Operator = {
  id: 1,
  name: 'Mohammed',
  pin_set: true,
  active: true,
  created_at: '2026-05-01T08:00:00Z',
};

export const FIXTURE_PRODUCT: Product = {
  id: 1,
  name: 'Capot moteur',
  active: true,
  created_at: '2026-05-01T08:00:00Z',
};

export const FIXTURE_CATEGORIES: CategoryConstant[] = [
  { kind: 'PMP', display_name: 'PMP Défauts' },
  { kind: 'INJECTION', display_name: 'Injection Défauts' },
];

export const FIXTURE_TYPE: DefectType = {
  id: 1,
  product_id: 1,
  category_kind: 'PMP',
  label: 'Coulure',
  is_other_fallback: false,
  display_order: 1,
  active: true,
  created_at: '2026-05-01T08:00:00Z',
};

export const FIXTURE_TYPE_FALLBACK: DefectType = {
  id: 2,
  product_id: 1,
  category_kind: 'PMP',
  label: 'Autre — préciser',
  is_other_fallback: true,
  display_order: 999,
  active: true,
  created_at: '2026-05-01T08:00:00Z',
};

export const FIXTURE_DEVICE: Device = {
  id: 'qc-stm32-pilot01',
  last_seen: '2026-05-17T09:00:00Z',
  config_version: 1,
  online: true,
};

export const FIXTURE_LOG: DefectLog = {
  id: 1,
  device_id: 'qc-stm32-pilot01',
  operator: { id: 1, name: 'Mohammed' },
  defect_type: { id: 1, label: 'Coulure', category_kind: 'PMP' },
  product: { id: 1, name: 'Capot moteur' },
  note: null,
  logged_at: '2026-05-17T09:00:00Z',
  received_at: '2026-05-17T09:00:01Z',
};

export const FIXTURE_LOGS: PaginatedLogs = {
  items: [FIXTURE_LOG],
  total: 1,
  page: 1,
  per_page: 50,
};

export const FIXTURE_FLAG: FeatureFlag = {
  name: 'offline_queue',
  enabled: true,
  description: "File d'attente hors ligne",
  updated_at: '2026-05-01T00:00:00Z',
};

export const FIXTURE_SUMMARY: SummaryPoint[] = [
  { date: '2026-05-17', count: 5 },
];

export const FIXTURE_BY_DEFECT: ByDefectPoint[] = [
  {
    defect_type_id: 1,
    label: 'Coulure',
    category_kind: 'PMP',
    product_id: 1,
    product_name: 'Capot moteur',
    count: 5,
  },
];

export const FIXTURE_BY_OPERATOR: ByOperatorPoint[] = [
  { operator_id: 1, name: 'Mohammed', count: 5 },
];

export const FIXTURE_HEATMAP: HeatmapPoint[] = [
  { hour: 9, count: 5 },
];
