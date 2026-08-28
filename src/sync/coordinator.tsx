import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { isNeonCloudConfigured } from '@/cloud/neon-client';
import { asSqlDatabase } from '@/data/database';
import { PreferencesRepository } from '@/data/preferences';
import { OfflineSyncEngine, getOrCreateSyncClientId } from './engine';
import { NeonDataApiSyncTransport } from './neon-transport';
import { syncStatusStore } from './status';

const FOREGROUND_SYNC_INTERVAL_MS = 60_000;

export function SyncCoordinator() {
  const sqlite = useSQLiteContext();

  useEffect(() => {
    let disposed = false;
    const engine = new OfflineSyncEngine(sqlite, new NeonDataApiSyncTransport());

    async function syncNow(): Promise<void> {
      if (disposed || !isNeonCloudConfigured()) return;
      const preferences = await new PreferencesRepository(asSqlDatabase(sqlite)).load();
      if (preferences.activeOwnerKey === 'guest') {
        syncStatusStore.update({ phase: 'IDLE', pendingCount: 0, blockedCount: 0, lastError: null });
        return;
      }
      const clientId = await getOrCreateSyncClientId(sqlite);
      await engine.run(preferences.activeOwnerKey, clientId);
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
