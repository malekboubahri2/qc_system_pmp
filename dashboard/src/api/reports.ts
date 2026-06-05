import { client } from './client';
import type { QualityReport } from '@/types';

// Aggregated quality metrics for a plant-local date range (admin only).
export async function getQualityReport(from?: string, to?: string): Promise<QualityReport> {
  const { data } = await client.get<QualityReport>('/reports/quality', {
    params: {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
  });
  return data;
}
