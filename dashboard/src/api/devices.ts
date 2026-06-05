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

// Presence ping from a station tablet — keeps it shown online while connected.
export async function heartbeat(deviceId: string, name?: string): Promise<void> {
  await client.post('/devices/heartbeat', { device_id: deviceId, name });
}

// Graceful logout — flip the station offline immediately.
export async function disconnectDevice(deviceId: string): Promise<void> {
  await client.post('/devices/disconnect', { device_id: deviceId });
}
