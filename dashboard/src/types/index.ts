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

export interface DefectCategory {
  id: number;
  name: string;
  display_order: number;
  active: boolean;
  defect_count: number;
  archived_at?: string;
}

export interface DefectType {
  id: number;
  category_id: number;
  label: string;
  display_order: number;
  active: boolean;
  archived_at?: string;
}

export interface DefectLog {
  id: number;
  device_id: string;
  operator_id: number;
  operator_name: string;
  defect_type_id: number;
  defect_label: string;
  category_name: string;
  product_ref: string;
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
  category: string;
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
  page_size: number;
}

export interface ApiError {
  detail: string;
}
