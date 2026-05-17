import { client } from './client';
import type { FeatureFlag } from '@/types';

export async function listFlags(): Promise<FeatureFlag[]> {
  const { data } = await client.get<FeatureFlag[]>('/flags');
  return data;
}

export async function updateFlag(
  name: string,
  body: { enabled: boolean; description?: string | null },
): Promise<FeatureFlag> {
  const { data } = await client.put<FeatureFlag>(`/flags/${name}`, body);
  return data;
}
