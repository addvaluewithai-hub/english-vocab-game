import type { SQLiteDatabase } from 'expo-sqlite';
import { asSqlDatabase } from '@/data/database';
import { createId } from '@/utils/id';
import { ensureSyncBootstrap } from './bootstrap';
import { RemoteChangeApplier } from './local-applier';
import { SyncOutboxRepository } from './outbox';
import { resolveMutableConflict, type MutableSyncVersion } from './protocol';
import { syncStatusStore, type SyncStatusStore } from './status';
import type { PendingSyncMutation, RemoteSyncEntity, SyncRunSummary, SyncTransport } from './types';

const PUSH_BATCH = 50;
const PULL_BATCH = 100;
const MAX_PULL_PAGES = 20;

function payloadDate(payload: Record<string, unknown>, key: string, fallback: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value : fallback;
}

function conflictVersion(
  mutation: PendingSyncMutation,
  remote: RemoteSyncEntity,
  clientId: string,
): 'LOCAL' | 'REMOTE' {
  const local: MutableSyncVersion = {
    entityId: mutation.entityId,
    version: mutation.entityVersion,
    updatedAt: payloadDate(mutation.payload, 'updated_at', mutation.createdAt),
    deletedAt: payloadDate(mutation.payload, 'deleted_at', '') || null,
    clientId,
  };
  const remoteVersion: MutableSyncVersion = {
    entityId: remote.entityId,
    version: remote.entityVersion,
    updatedAt: payloadDate(remote.payload, 'updated_at', mutation.createdAt),
    deletedAt: payloadDate(remote.payload, 'deleted_at', '') || null,
    clientId: 'server',
  };
  return resolveMutableConflict(local, remoteVersion);
}

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
  private running: Promise<SyncRunSummary> | null = null;

  constructor(
    private readonly sqlite: SQLiteDatabase,
    private readonly transport: SyncTransport,
    private readonly status: SyncStatusStore = syncStatusStore,
  ) {}

  run(ownerKey: string, clientId: string): Promise<SyncRunSummary> {
    if (this.running) return this.running;
    this.running = this.runInternal(ownerKey, clientId).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runInternal(ownerKey: string, clientId: string): Promise<SyncRunSummary> {
    const db = asSqlDatabase(this.sqlite);
    const outbox = new SyncOutboxRepository(db);
    const applier = new RemoteChangeApplier(this.sqlite);
    const summary: SyncRunSummary = {
      pushed: 0,
      pulled: 0,
      deferred: 0,
      blocked: 0,
      cursor: await outbox.pullCursor(ownerKey),
    };

    if (ownerKey === 'guest') {
      this.status.update({ phase: 'IDLE', pendingCount: 0, blockedCount: 0, lastError: null });
      return summary;
    }

    await ensureSyncBootstrap(db, ownerKey);
    this.status.update({
      phase: 'SYNCING',
      pendingCount: await outbox.pendingCount(ownerKey),
      blockedCount: await outbox.blockedCount(ownerKey),
      lastError: null,
    });

    let networkFailure: string | null = null;
    const pending = await outbox.listDue(ownerKey, new Date(), PUSH_BATCH);
    for (const mutation of pending) {
      try {
        const result = await this.transport.pushMutation(ownerKey, clientId, mutation);
        if (result.status === 'APPLIED' || result.status === 'DUPLICATE') {
          await outbox.acknowledge(mutation.id);
          summary.pushed += 1;
          continue;
        }
        if (result.status === 'CONFLICT') {
          if (conflictVersion(mutation, result.remote, clientId) === 'LOCAL') {
            await outbox.rebaseOnRemote(mutation, result.remote.entityVersion);
            summary.deferred += 1;
          } else {
            await applier.apply(ownerKey, [result.remote]);
            await outbox.acknowledge(mutation.id);
            summary.pulled += 1;
          }
          continue;
        }
        await outbox.quarantine(mutation, result.code, result.message);
        summary.blocked += 1;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Network sync failed.';
        await outbox.defer(mutation, 'NETWORK', message);
        summary.deferred += 1;
        networkFailure = message;
        break;
      }
    }

    if (!networkFailure) {
      try {
        for (let pageIndex = 0; pageIndex < MAX_PULL_PAGES; pageIndex += 1) {
          const page = await this.transport.pullChanges(ownerKey, clientId, summary.cursor, PULL_BATCH);
          summary.pulled += await applier.apply(ownerKey, page.changes);
          summary.cursor = page.nextCursor;
          await outbox.setPullCursor(ownerKey, summary.cursor);
          if (!page.hasMore) break;
        }
        await outbox.markLastSynced(ownerKey);
      } catch (caught) {
        networkFailure = caught instanceof Error ? caught.message : 'Could not pull cloud changes.';
      }
    }

    const pendingCount = await outbox.pendingCount(ownerKey);
    const blockedCount = await outbox.blockedCount(ownerKey);
    const lastSyncedAt = await outbox.lastSyncedAt(ownerKey);
    this.status.update({
      phase: networkFailure ? 'OFFLINE' : blockedCount > 0 ? 'ERROR' : 'IDLE',
      pendingCount,
      blockedCount,
      lastSyncedAt,
      lastError: networkFailure ?? (blockedCount > 0 ? 'Some changes need attention before they can sync.' : null),
    });
    return summary;
  }
}
