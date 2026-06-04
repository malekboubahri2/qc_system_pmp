import axios from 'axios';
import { createInspection } from '@/api/inspections';
import type { InspectionCreate } from '@/types';
import { offlineQueue } from './queue';

export interface SubmitResult {
  queued: boolean;
}

// A network error is an axios error with no HTTP response (request never
// completed). A 4xx/5xx *did* reach the server — that's a real error to surface,
// not something to queue.
export function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response;
}

// Send the inspection, or persist it to the offline queue if the network is
// down. Real server errors (validation, auth) propagate.
export async function submitOrQueue(payload: InspectionCreate): Promise<SubmitResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await offlineQueue.enqueue(payload);
    return { queued: true };
  }
  try {
    await createInspection(payload);
    return { queued: false };
  } catch (err) {
    if (isNetworkError(err)) {
      await offlineQueue.enqueue(payload);
      return { queued: true };
    }
    throw err;
  }
}
