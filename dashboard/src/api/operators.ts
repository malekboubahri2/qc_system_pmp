import { client } from './client';
import type { Operator } from '@/types';

export async function listOperators(includeArchived = false): Promise<Operator[]> {
  const { data } = await client.get<Operator[]>('/operators', {
    params: includeArchived ? { include_archived: true } : undefined,
  });
  return data;
}

export async function createOperator(name: string): Promise<Operator> {
  const { data } = await client.post<Operator>('/operators', { name });
  return data;
}

export async function updateOperator(id: number, body: { name: string }): Promise<Operator> {
  const { data } = await client.patch<Operator>(`/operators/${id}`, body);
  return data;
}

export async function setPin(id: number, pin: string): Promise<void> {
  await client.post(`/operators/${id}/pin`, { pin });
}

export async function archiveOperator(id: number): Promise<void> {
  await client.delete(`/operators/${id}`);
}
