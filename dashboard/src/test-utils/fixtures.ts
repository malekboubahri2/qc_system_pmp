import type {
  User, Operator, Product, CategoryConstant, DefectType, DefectLog,
  Device, FeatureFlag, PaginatedLogs,
  SummaryPoint, ByDefectPoint, ByOperatorPoint, HeatmapPoint,
  HourlyReport, HourlyRow, LiveStationsResponse, LiveProductsResponse,
} from '@/types';

export const FIXTURE_USER: User = {
  id: 1,
  email: 'admin@qc.local',
  role: 'admin',
  operator_id: null,
};

export const FIXTURE_OPERATOR: Operator = {
  id: 1,
  name: 'Mohammed',
  username: 'mohammed',
  has_login: true,
  pin_set: false,
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

export const FIXTURE_LIVE_STATIONS: LiveStationsResponse = {
  updated_at: '2026-06-02T10:00:00Z',
  stations: [
    {
      device_id: 'qc-stm32-001a2b3c',
      online: true,
      last_seen: '2026-06-02T09:59:30Z',
      session_active: true,
      operator_id: 1,
      operator_name: 'Mohammed',
      product_id: 1,
      product_name: 'Capot moteur',
      session_started_at: '2026-06-02T07:42:00Z',
      defect_count: 5,
      ok_count: 12,
      today_count: 17,
      last_hour_defects: 2,
      feed: [
        { id: 101, label: 'Coulure', category: 'PMP Défauts', note: null, logged_at: '2026-06-02T09:58:00Z', is_other: false },
        { id: 102, label: 'Bavure', category: 'Injection Défauts', note: null, logged_at: '2026-06-02T09:50:00Z', is_other: false },
      ],
    },
  ],
};

export const FIXTURE_LIVE_PRODUCTS: LiveProductsResponse = {
  updated_at: '2026-06-02T10:00:00Z',
  products: [
    {
      product_id: 1,
      product_name: 'Capot moteur',
      reference: 'CM-100',
      client: 'Renault',
      active: true,
      last_activity: '2026-06-02T09:58:00Z',
      parts_today: 17,
      nc_parts: 4,
      ok_parts: 13,
      defect_count: 5,
      nc_rate: 0.2353,
      last_hour_parts: 6,
      active_operators: 2,
      operators: [
        { operator_id: 1, operator_name: 'Mohammed', parts: 10, nc_parts: 3, nc_rate: 0.3, last_at: '2026-06-02T09:58:00Z', active: true },
        { operator_id: 2, operator_name: 'Sofia', parts: 7, nc_parts: 1, nc_rate: 0.1429, last_at: '2026-06-02T09:55:00Z', active: true },
      ],
      feed: [
        { id: 201, label: 'Coulure', category: 'PMP Défauts', note: null, operator_name: 'Mohammed', logged_at: '2026-06-02T09:58:00Z', is_other: false },
        { id: 202, label: 'Bavure', category: 'Injection Défauts', note: null, operator_name: 'Sofia', logged_at: '2026-06-02T09:50:00Z', is_other: false },
      ],
    },
  ],
};

export const FIXTURE_LOG: DefectLog = {
  id: 1,
  device_id: 'qc-stm32-pilot01',
  operator: { id: 1, name: 'Mohammed' },
  defect_type: { id: 1, label: 'Coulure', category_kind: 'PMP' },
  product: { id: 1, name: 'Capot moteur' },
  outcome: 'DEFECT',
  note: null,
  logged_at: '2026-05-17T09:00:00Z',
  received_at: '2026-05-17T09:00:01Z',
};

// 24-row stub — hours 7 and 8 have realistic data, rest are zero
const _EMPTY_ROW = (h: number): HourlyRow => ({
  hour: h, pmp_total: 0, pmp_defects: 0, pmp_defect_total: 0, pmp_rate: 0,
  inj_total: 0, inj_defects: 0, inj_defect_total: 0, inj_rate: 0,
});
export const FIXTURE_HOURLY_REPORT: HourlyReport = {
  date: '2026-05-19',
  rows: Array.from({ length: 24 }, (_, h): HourlyRow => {
    if (h === 7) return { hour: 7, pmp_total: 12, pmp_defects: 2, pmp_defect_total: 3, pmp_rate: 0.1667, inj_total: 12, inj_defects: 1, inj_defect_total: 1, inj_rate: 0.0833 };
    if (h === 8) return { hour: 8, pmp_total: 18, pmp_defects: 4, pmp_defect_total: 5, pmp_rate: 0.2222, inj_total: 18, inj_defects: 2, inj_defect_total: 3, inj_rate: 0.1111 };
    return _EMPTY_ROW(h);
  }),
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
