import { client } from './client';
import type { HourlyReport } from '@/types';

export async function getHourlyReport(date?: string): Promise<HourlyReport> {
  const params: Record<string, string> = {};
  if (date) params['date'] = date;
  const { data } = await client.get<HourlyReport>('/inspection-logs/reports/hourly', { params });
  return data;
}
