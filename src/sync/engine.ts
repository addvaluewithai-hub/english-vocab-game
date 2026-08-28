import type { SQLiteDatabase } from 'expo-sqlite';
import { asSqlDatabase } from '@/data/database';
import { createId } from '@/utils/id';
import { ensureSyncBootstrap } from './bootstrap';
import { SyncEngineCore } from './core';
import { RemoteChangeApplier } from './local-applier';
import { SyncOutboxRepository } from './outbox';
import { syncStatusStore, type SyncStatusStore } from './status';
import type { SyncRunSummary, SyncTransport } from './types';

export async function getOrCreateSyncClientId(sqlite: SQLiteDatabase): Promise<string> {
  const db = asSqlDatabase(sqlite);
  const existing = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key='client_id'",
  );
  if (existing?.value) return existing.value;
  const value = createId('device');
  const now = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO sync_meta(key,value,updated_at) VALUES('client_id',?,?)",
    value,
    now,
  );
  return value;
}

export class OfflineSyncEngine {
  private readonly core: SyncEngineCore;

  constructor(
    sqlite: SQLiteDatabase,
    transport: SyncTransport,
    status: SyncStatusStore = syncStatusStore,
  ) {
    const db = asSqlDatabase(sqlite);
    this.core = new SyncEngineCore(
      transport,
      new SyncOutboxRepository(db),
      new RemoteChangeApplier(sqlite),
      status,
      async (ownerKey) => {
        await ensureSyncBootstrap(db, ownerKey);
      },
    );
  }

  run(ownerKey: string, clientId: string): Promise<SyncRunSummary> {
    return this.core.run(ownerKey, clientId);
  }
}
