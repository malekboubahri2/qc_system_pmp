import { client } from './client';
import type { PaginatedLogs } from '@/types';

export interface LogFilters {
  from?: string;
  to?: string;
  operator_id?: number;
  defect_type_id?: number;
  device_id?: string;
  product_id?: number;
}

export async function listLogs(
  filters: LogFilters,
  page = 1,
  perPage = 50,
): Promise<PaginatedLogs> {
  const params: Record<string, unknown> = { page, per_page: perPage };
  if (filters.from) params['from'] = filters.from;
  if (filters.to) params['to'] = filters.to;
  if (filters.operator_id) params['operator_id'] = filters.operator_id;
  if (filters.defect_type_id) params['defect_type_id'] = filters.defect_type_id;
  if (filters.device_id) params['device_id'] = filters.device_id;
  if (filters.product_id) params['product_id'] = filters.product_id;

  const { data } = await client.get<PaginatedLogs>('/logs', { params });
  return data;
}

export async function downloadCsv(filters: LogFilters): Promise<void> {
  const params: Record<string, unknown> = {};
  if (filters.from) params['from'] = filters.from;
  if (filters.to) params['to'] = filters.to;
  if (filters.operator_id) params['operator_id'] = filters.operator_id;
  if (filters.defect_type_id) params['defect_type_id'] = filters.defect_type_id;
  if (filters.device_id) params['device_id'] = filters.device_id;
  if (filters.product_id) params['product_id'] = filters.product_id;

  const resp = await client.get<Blob>('/logs/export.csv', {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `defect-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
