import { client } from './client';
import type { SummaryPoint, ByDefectPoint, ByOperatorPoint, HeatmapPoint } from '@/types';

export async function getSummary(days = 7): Promise<SummaryPoint[]> {
  const { data } = await client.get<SummaryPoint[]>('/stats/summary', { params: { days } });
  return data;
}

export async function getByDefect(days = 30): Promise<ByDefectPoint[]> {
  const { data } = await client.get<ByDefectPoint[]>('/stats/by-defect', { params: { days } });
  return data;
}

export async function getByOperator(days = 30): Promise<ByOperatorPoint[]> {
  const { data } = await client.get<ByOperatorPoint[]>('/stats/by-operator', { params: { days } });
  return data;
}

export async function getHeatmap(days = 30): Promise<HeatmapPoint[]> {
  const { data } = await client.get<HeatmapPoint[]>('/stats/heatmap', { params: { days } });
  return data;
}
