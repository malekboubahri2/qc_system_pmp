import type {
  User, Operator, DefectCategory, DefectType, DefectLog,
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

export const FIXTURE_CATEGORY: DefectCategory = {
  id: 1,
  name: 'Peinture',
  display_order: 1,
  active: true,
  defect_count: 1,
};

export const FIXTURE_TYPE: DefectType = {
  id: 1,
  category_id: 1,
  label: 'Coulure',
  display_order: 1,
  active: true,
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
  operator_id: 1,
  operator_name: 'Mohammed',
  defect_type_id: 1,
  defect_label: 'Coulure',
  category_name: 'Peinture',
  product_ref: 'LOT-2026-001',
  logged_at: '2026-05-17T09:00:00Z',
  received_at: '2026-05-17T09:00:01Z',
};

export const FIXTURE_LOGS: PaginatedLogs = {
  items: [FIXTURE_LOG],
  total: 1,
  page: 1,
  page_size: 50,
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
  { defect_type_id: 1, label: 'Coulure', category: 'Peinture', count: 5 },
];

export const FIXTURE_BY_OPERATOR: ByOperatorPoint[] = [
  { operator_id: 1, name: 'Mohammed', count: 5 },
];

export const FIXTURE_HEATMAP: HeatmapPoint[] = [
  { hour: 9, count: 5 },
];
