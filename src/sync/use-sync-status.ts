import { useSyncExternalStore } from 'react';
import { syncStatusStore } from './status';
import type { SyncSnapshot } from './types';

export function useSyncStatus(): SyncSnapshot {
  return useSyncExternalStore(
    (listener) => syncStatusStore.subscribe(listener),
    () => syncStatusStore.snapshot,
    () => syncStatusStore.snapshot,
  );
}
