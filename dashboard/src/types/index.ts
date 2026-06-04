export interface User {
  id: number;
  email: string;
  name: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface Operator {
  id: number;
  name: string;
  pin_set: boolean;
  active: boolean;
  created_at: string;
  archived_at?: string;
}

// Returned once on create / regenerate-pin — `pin` is plaintext, shown once.
export interface OperatorWithPin extends Operator {
  pin: string;
}

// PWA inspection submission (schema 4): one part → many rows server-side.
export interface InspectionCreate {
  device_id?: string;
  operator_id: number;
  product_id: number;
  pmp_defect_type_ids: number[];
  inj_defect_type_ids: number[];
  note?: string | null;
  logged_at?: string | null;
}

export interface InspectionCreateResponse {
  part_inspection_id: string;
}

export interface KpiSnapshot {
  date: string;
  inspected_parts: number;
  nc_parts: number;
  ok_parts: number;
  nc_rate: number;
  defect_count: number;
  last_hour_parts: number;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  active: boolean;
  created_at: string;
}

export interface CategoryConstant {
  kind: string;
  display_name: string;
}

export interface DefectType {
  id: number;
  product_id: number;
  category_kind: string;
  label: string;
  is_other_fallback: boolean;
  display_order: number;
  active: boolean;
  created_at: string;
}

export interface DefectLog {
  id: number;
  device_id: string;
  operator: { id: number; name: string };
  defect_type: { id: number; label: string; category_kind: string } | null;
  product: { id: number; name: string };
  outcome: 'DEFECT' | 'OK';
  note: string | null;
  logged_at: string;
  received_at: string;
}

export interface HourlyRow {
  hour: number;
  pmp_total: number;
  pmp_defects: number;       // non-conforming parts (drives the rate)
  pmp_defect_total: number;  // individual defects logged
  pmp_rate: number;
  inj_total: number;
  inj_defects: number;
  inj_defect_total: number;
  inj_rate: number;
}

export interface HourlyReport {
  date: string;
  rows: HourlyRow[];
}

export interface Device {
  id: string;
  last_seen?: string;
  config_version?: number;
  online: boolean;
}

export interface LiveFeedEntryDTO {
  id: number;
  label: string;
  category: string;
  note: string | null;
  logged_at: string;
  is_other: boolean;
}

export interface LiveStationDTO {
  device_id: string;
  online: boolean;
  last_seen: string | null;
  session_active: boolean;
  operator_id: number | null;
  operator_name: string | null;
  product_id: number | null;
  product_name: string | null;
  session_started_at: string | null;
  defect_count: number;
  ok_count: number;
  today_count: number;
  last_hour_defects: number;
  feed: LiveFeedEntryDTO[];
}

export interface LiveStationsResponse {
  updated_at: string;
  stations: LiveStationDTO[];
}

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  updated_at: string;
}

export interface SummaryPoint {
  date: string;
  count: number;
}

export interface ByDefectPoint {
  defect_type_id: number;
  label: string;
  category_kind: string;
  product_id: number;
  product_name: string;
  count: number;
}

export interface ByOperatorPoint {
  operator_id: number;
  name: string;
  count: number;
}

export interface HeatmapPoint {
  hour: number;
  count: number;
}

export interface PaginatedLogs {
  items: DefectLog[];
  total: number;
  page: number;
  per_page: number;
}

export interface ApiError {
  detail: string;
}
