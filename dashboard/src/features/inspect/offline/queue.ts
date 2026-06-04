import type { InspectionCreate } from '@/types';

export interface QueuedInspection {
  id: string;
  payload: InspectionCreate;
  queued_at: string;
}

// Persisted store of inspections that couldn't reach the server (Wi-Fi drop).
// Drains on reconnect. Cap mirrors the firmware queue (~24h of typical use).
export const QUEUE_CAP = 1000;

const DB_NAME = 'qc-inspect';
const DB_VERSION = 1;
const STORE = 'pending';

export interface QueueBackend {
  add(item: QueuedInspection): Promise<void>;
  list(): Promise<QueuedInspection[]>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}

// ── In-memory backend (tests, or environments without IndexedDB) ────────────
export function memoryBackend(): QueueBackend {
  let items: QueuedInspection[] = [];
  return {
    async add(item) { items.push(item); },
    async list() { return [...items]; },
    async delete(id) { items = items.filter((i) => i.id !== id); },
    async count() { return items.length; },
  };
}

// ── IndexedDB backend ───────────────────────────────────────────────────────
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(STORE, mode).objectStore(STORE);
        const req = run(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function idbBackend(): QueueBackend {
  return {
    add: (item) => tx('readwrite', (s) => s.add(item)).then(() => undefined),
    list: () => tx('readonly', (s) => s.getAll() as IDBRequest<QueuedInspection[]>),
    delete: (id) => tx('readwrite', (s) => s.delete(id)).then(() => undefined),
    count: () => tx('readonly', (s) => s.count()),
  };
}

// ── Queue ───────────────────────────────────────────────────────────────────
type Listener = () => void;

export class OfflineQueue {
  private listeners = new Set<Listener>();
  private backend: QueueBackend;

  constructor(backend: QueueBackend) {
    this.backend = backend;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  async enqueue(payload: InspectionCreate): Promise<void> {
    if ((await this.backend.count()) >= QUEUE_CAP) {
      throw new Error('offline queue full');
    }
    await this.backend.add({
      id: genId(),
      payload,
      queued_at: new Date().toISOString(),
    });
    this.emit();
  }

  count(): Promise<number> {
    return this.backend.count();
  }

  /**
   * Send queued inspections oldest-first. Stops at the first failure so order
   * is preserved and a persistent server error doesn't spin. Returns how many
   * were sent and whether the queue is now empty.
   */
  async drain(send: (payload: InspectionCreate) => Promise<unknown>): Promise<{ sent: number; drained: boolean }> {
    const items = (await this.backend.list()).sort((a, b) =>
      a.queued_at < b.queued_at ? -1 : 1,
    );
    let sent = 0;
    for (const item of items) {
      try {
        await send(item.payload);
        await this.backend.delete(item.id);
        sent += 1;
      } catch {
        if (sent) this.emit();
        return { sent, drained: false };
      }
    }
    if (sent) this.emit();
    return { sent, drained: true };
  }
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

export const offlineQueue = new OfflineQueue(
  hasIndexedDb() ? idbBackend() : memoryBackend(),
);
