import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/inspections', () => ({ createInspection: vi.fn() }));

import { createInspection } from '@/api/inspections';
import { submitOrQueue } from '../submitOrQueue';
import { offlineQueue } from '../queue';
import type { InspectionCreate } from '@/types';

const mockCreate = vi.mocked(createInspection);

const payload: InspectionCreate = {
  operator_id: 1,
  product_id: 1,
  pmp_defect_type_ids: [],
  inj_defect_type_ids: [],
};

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

describe('submitOrQueue', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    setOnline(true);
  });
  afterEach(async () => {
    // Clear any residue from the shared singleton between tests.
    setOnline(true);
    await offlineQueue.drain(async () => undefined);
  });

  it('posts directly when online', async () => {
    mockCreate.mockResolvedValue({ part_inspection_id: 'x' });
    const res = await submitOrQueue(payload);
    expect(res).toEqual({ queued: false });
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('queues without calling the API when offline', async () => {
    setOnline(false);
    const before = await offlineQueue.count();
    const res = await submitOrQueue(payload);
    expect(res).toEqual({ queued: true });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(await offlineQueue.count()).toBe(before + 1);
  });

  it('queues on a network error (no HTTP response)', async () => {
    const err = Object.assign(new Error('Network Error'), {
      isAxiosError: true,
      response: undefined,
    });
    mockCreate.mockRejectedValue(err);
    const res = await submitOrQueue(payload);
    expect(res).toEqual({ queued: true });
  });

  it('propagates a real server error (4xx/5xx) instead of queuing', async () => {
    const err = Object.assign(new Error('Bad Request'), {
      isAxiosError: true,
      response: { status: 400 },
    });
    mockCreate.mockRejectedValue(err);
    await expect(submitOrQueue(payload)).rejects.toBe(err);
  });
});
