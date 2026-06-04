import { client } from './client';
import type { Operator, OperatorWithCredentials } from '@/types';

export async function listOperators(includeArchived = false): Promise<Operator[]> {
  const { data } = await client.get<Operator[]>('/operators', {
    params: includeArchived ? { include_archived: true } : undefined,
  });
  return data;
}

// The server creates the login user and returns username + password once.
export async function createOperator(name: string): Promise<OperatorWithCredentials> {
  const { data } = await client.post<OperatorWithCredentials>('/operators', { name });
  return data;
}

// Rotates the login password, returning the new value once.
export async function regeneratePassword(id: number): Promise<OperatorWithCredentials> {
  const { data } = await client.post<OperatorWithCredentials>(
    `/operators/${id}/regenerate-password`,
  );
  return data;
}

export async function updateOperator(id: number, body: { name: string }): Promise<Operator> {
  const { data } = await client.patch<Operator>(`/operators/${id}`, body);
  return data;
}

export async function archiveOperator(id: number): Promise<void> {
  await client.delete(`/operators/${id}`);
}
