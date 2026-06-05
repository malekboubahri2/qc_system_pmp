import { client } from './client';
import type { Operator, OperatorWithCredentials } from '@/types';

export async function listOperators(includeArchived = false): Promise<Operator[]> {
  const { data } = await client.get<Operator[]>('/operators', {
    params: includeArchived ? { include_archived: true } : undefined,
  });
  return data;
}

export interface OperatorInput {
  matricule: string;
  name: string;
  last_name?: string | null;
  phone?: string | null;
  address?: string | null;
}

// The matricule is the login; the server returns username (= matricule) +
// password once.
export async function createOperator(body: OperatorInput): Promise<OperatorWithCredentials> {
  const { data } = await client.post<OperatorWithCredentials>('/operators', body);
  return data;
}

// Rotates the login password, returning the new value once.
export async function regeneratePassword(id: number): Promise<OperatorWithCredentials> {
  const { data } = await client.post<OperatorWithCredentials>(
    `/operators/${id}/regenerate-password`,
  );
  return data;
}

export async function updateOperator(
  id: number,
  body: Partial<Omit<OperatorInput, 'matricule'>>,
): Promise<Operator> {
  const { data } = await client.patch<Operator>(`/operators/${id}`, body);
  return data;
}

export async function archiveOperator(id: number): Promise<void> {
  await client.delete(`/operators/${id}`);
}
