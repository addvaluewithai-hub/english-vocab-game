import type { SyncSnapshot } from './types';

export type SyncListener = (snapshot: SyncSnapshot) => void;

const INITIAL: SyncSnapshot = {
  phase: 'IDLE',
  pendingCount: 0,
  blockedCount: 0,
  lastSyncedAt: null,
  lastError: null,
};

export class SyncStatusStore {
  private value: SyncSnapshot = INITIAL;
  private listeners = new Set<SyncListener>();

  get snapshot(): SyncSnapshot {
    return this.value;
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.value);
    return () => this.listeners.delete(listener);
  }

  update(patch: Partial<SyncSnapshot>): void {
    this.value = { ...this.value, ...patch };
    for (const listener of this.listeners) listener(this.value);
  }
}

export const syncStatusStore = new SyncStatusStore();
