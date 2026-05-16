import { client } from './client';
import type { AuthToken, User } from '@/types';

export async function login(email: string, password: string): Promise<AuthToken> {
  const { data } = await client.post<AuthToken>('/auth/login', { email, password });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await client.get<User>('/auth/me');
  return data;
}
