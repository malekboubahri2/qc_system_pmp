import { client } from './client';
import type { Device, LiveStationsResponse } from '@/types';

export async function listDevices(): Promise<Device[]> {
  const { data } = await client.get<Device[]>('/devices');
  return data;
}

export async function getLiveStations(): Promise<LiveStationsResponse> {
  const { data } = await client.get<LiveStationsResponse>('/devices/live');
  return data;
}
