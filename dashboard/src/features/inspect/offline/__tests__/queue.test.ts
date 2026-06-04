import { describe, it, expect, vi } from 'vitest';
import { OfflineQueue, memoryBackend } from '../queue';
import type { InspectionCreate } from '@/types';

const payload = (operatorId: number): InspectionCreate => ({
  operator_id: operatorId,
  product_id: 1,
  pmp_defect_type_ids: [],
  inj_defect_type_ids: [],
});

describe('OfflineQueue', () => {
  it('enqueues and counts', async () => {
    const q = new OfflineQueue(memoryBackend());
    await q.enqueue(payload(1));
    await q.enqueue(payload(2));
    expect(await q.count()).toBe(2);
  });

  it('drains all when every send succeeds', async () => {
    const q = new OfflineQueue(memoryBackend());
    await q.enqueue(payload(1));
    await q.enqueue(payload(2));
    const send = vi.fn().mockResolvedValue(undefined);

    const res = await q.drain(send);

    expect(send).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ sent: 2, drained: true });
    expect(await q.count()).toBe(0);
  });

  it('stops at the first failure and keeps the rest queued', async () => {
    const q = new OfflineQueue(memoryBackend());
    await q.enqueue(payload(1));
    await q.enqueue(payload(2));
    const send = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('network'));

    const res = await q.drain(send);

    expect(res).toEqual({ sent: 1, drained: false });
    expect(await q.count()).toBe(1);
  });

  it('notifies subscribers on enqueue', async () => {
    const q = new OfflineQueue(memoryBackend());
    const fn = vi.fn();
    q.subscribe(fn);
    await q.enqueue(payload(1));
    expect(fn).toHaveBeenCalled();
  });
});
