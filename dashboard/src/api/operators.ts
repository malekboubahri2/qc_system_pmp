import { client } from './client';
import type { Operator, OperatorWithPin } from '@/types';

export async function listOperators(includeArchived = false): Promise<Operator[]> {
  const { data } = await client.get<Operator[]>('/operators', {
    params: includeArchived ? { include_archived: true } : undefined,
  });
  return data;
}

// The server mints a unique PIN and returns it once (in `pin`).
export async function createOperator(name: string): Promise<OperatorWithPin> {
  const { data } = await client.post<OperatorWithPin>('/operators', { name });
  return data;
}

// Rotates the PIN, returning the new plaintext value once.
export async function regeneratePin(id: number): Promise<OperatorWithPin> {
  const { data } = await client.post<OperatorWithPin>(`/operators/${id}/regenerate-pin`);
  return data;
}

// Server-side PIN check for the PWA login step. Resolves true on 204, false on 401.
export async function verifyPin(operatorId: number, pin: string): Promise<boolean> {
  try {
    await client.post('/operators/verify-pin', { operator_id: operatorId, pin });
    return true;
  } catch (err) {
    if (isAxios401(err)) return false;
    throw err;
  }
}

function isAxios401(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null &&
    'response' in err &&
    (err as { response?: { status?: number } }).response?.status === 401
  );
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
