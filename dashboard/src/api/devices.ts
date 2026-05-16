import { client } from './client';
import type { Device } from '@/types';

export async function listDevices(): Promise<Device[]> {
  const { data } = await client.get<Device[]>('/devices');
  return data;
}
