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
  defect_type: { id: number; label: string; category_kind: string };
  product: { id: number; name: string };
  note: string | null;
  logged_at: string;
  received_at: string;
}

export interface Device {
  id: string;
  last_seen?: string;
  config_version?: number;
  online: boolean;
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
