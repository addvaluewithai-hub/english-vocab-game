import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { isNeonCloudConfigured } from '@/cloud/neon-client';
import { asSqlDatabase } from '@/data/database';
import { PreferencesRepository } from '@/data/preferences';
import { OfflineSyncEngine, getOrCreateSyncClientId } from './engine';
import { NeonDataApiSyncTransport } from './neon-transport';
import { syncStatusStore } from './status';
import type { SyncRunSummary } from './types';

const FOREGROUND_SYNC_INTERVAL_MS = 60_000;

export async function syncCloudNow(
  sqlite: SQLiteDatabase,
  ownerKey?: string,
): Promise<SyncRunSummary | null> {
  if (!isNeonCloudConfigured()) return null;
  const activeOwner = ownerKey
    ?? (await new PreferencesRepository(asSqlDatabase(sqlite)).load()).activeOwnerKey;
  if (activeOwner === 'guest') {
    syncStatusStore.update({ phase: 'IDLE', pendingCount: 0, blockedCount: 0, lastError: null });
    return null;
  }
  const clientId = await getOrCreateSyncClientId(sqlite);
  return new OfflineSyncEngine(sqlite, new NeonDataApiSyncTransport()).run(activeOwner, clientId);
}

export function SyncCoordinator() {
  const sqlite = useSQLiteContext();

  useEffect(() => {
    let disposed = false;

    async function syncNow(): Promise<void> {
      if (disposed) return;
      await syncCloudNow(sqlite);
    }

    void syncNow().catch((caught: unknown) => {
      syncStatusStore.update({
        phase: 'OFFLINE',
        lastError: caught instanceof Error ? caught.message : 'Cloud sync is temporarily unavailable.',
      });
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNow();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void syncNow();
    }, FOREGROUND_SYNC_INTERVAL_MS);

    return () => {
      disposed = true;
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, [sqlite]);

  return null;
}
