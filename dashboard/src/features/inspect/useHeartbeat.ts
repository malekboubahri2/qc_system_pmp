import { useEffect } from 'react';
import { heartbeat } from '@/api/devices';
import { getDeviceId, getDeviceName } from './device';

const INTERVAL_MS = 20_000;

// Pings presence every 20s while the operator is on the PWA, so the station
// shows "online" in the dashboard the whole time it's connected (not only right
// after a submission).
export function useHeartbeat(): void {
  useEffect(() => {
    const id = getDeviceId();
    const name = getDeviceName();
    const ping = () => { heartbeat(id, name).catch(() => {}); };
    ping();
    const timer = setInterval(ping, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
}
