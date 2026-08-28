import { resolveMutableConflict, type MutableSyncVersion } from './protocol';
import type {
  PendingSyncMutation,
  RemoteSyncEntity,
  SyncRunSummary,
  SyncSnapshot,
  SyncTransport,
} from './types';

const PUSH_BATCH = 50;
const PULL_BATCH = 100;
const MAX_PULL_PAGES = 20;

export interface SyncOutboxPort {
  pullCursor(ownerKey: string): Promise<number>;
  pendingCount(ownerKey: string): Promise<number>;
  blockedCount(ownerKey: string): Promise<number>;
  listDue(ownerKey: string, now: Date, limit: number): Promise<PendingSyncMutation[]>;
  acknowledge(id: string): Promise<void>;
  defer(mutation: PendingSyncMutation, code: string, message: string): Promise<void>;
  quarantine(mutation: PendingSyncMutation, code: string, message: string): Promise<void>;
  rebaseOnRemote(mutation: PendingSyncMutation, remoteVersion: number): Promise<PendingSyncMutation>;
  setPullCursor(ownerKey: string, cursor: number): Promise<void>;
  markLastSynced(ownerKey: string): Promise<void>;
  lastSyncedAt(ownerKey: string): Promise<string | null>;
}

export interface SyncChangeApplierPort {
  apply(ownerKey: string, changes: RemoteSyncEntity[]): Promise<number>;
}

export interface SyncStatusPort {
  update(patch: Partial<SyncSnapshot>): void;
}

export type SyncBootstrapPort = (ownerKey: string) => Promise<void>;

function payloadDate(payload: Record<string, unknown>, key: string, fallback: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value : fallback;
}

function conflictWinner(
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

export class SyncEngineCore {
  private running: Promise<SyncRunSummary> | null = null;

  constructor(
    private readonly transport: SyncTransport,
    private readonly outbox: SyncOutboxPort,
    private readonly applier: SyncChangeApplierPort,
    private readonly status: SyncStatusPort,
    private readonly bootstrap: SyncBootstrapPort,
  ) {}

  run(ownerKey: string, clientId: string): Promise<SyncRunSummary> {
    if (this.running) return this.running;
    this.running = this.runInternal(ownerKey, clientId).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runInternal(ownerKey: string, clientId: string): Promise<SyncRunSummary> {
    const summary: SyncRunSummary = {
      pushed: 0,
      pulled: 0,
      deferred: 0,
      blocked: 0,
      cursor: await this.outbox.pullCursor(ownerKey),
    };

    if (ownerKey === 'guest') {
      this.status.update({ phase: 'IDLE', pendingCount: 0, blockedCount: 0, lastError: null });
      return summary;
    }

    await this.bootstrap(ownerKey);
    this.status.update({
      phase: 'SYNCING',
      pendingCount: await this.outbox.pendingCount(ownerKey),
      blockedCount: await this.outbox.blockedCount(ownerKey),
      lastError: null,
    });

    let networkFailure: string | null = null;
    const pending = await this.outbox.listDue(ownerKey, new Date(), PUSH_BATCH);
    for (const mutation of pending) {
      try {
        const result = await this.transport.pushMutation(ownerKey, clientId, mutation);
        if (result.status === 'APPLIED' || result.status === 'DUPLICATE') {
          await this.outbox.acknowledge(mutation.id);
          summary.pushed += 1;
          continue;
        }

        if (result.status === 'CONFLICT') {
          if (conflictWinner(mutation, result.remote, clientId) === 'LOCAL') {
            await this.outbox.rebaseOnRemote(mutation, result.remote.entityVersion);
            summary.deferred += 1;
          } else {
            await this.applier.apply(ownerKey, [result.remote]);
            await this.outbox.acknowledge(mutation.id);
            summary.pulled += 1;
          }
          continue;
        }

        await this.outbox.quarantine(mutation, result.code, result.message);
        summary.blocked += 1;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Network sync failed.';
        await this.outbox.defer(mutation, 'NETWORK', message);
        summary.deferred += 1;
        networkFailure = message;
        break;
      }
    }

    if (!networkFailure) {
      try {
        for (let pageIndex = 0; pageIndex < MAX_PULL_PAGES; pageIndex += 1) {
          const page = await this.transport.pullChanges(ownerKey, clientId, summary.cursor, PULL_BATCH);
          summary.pulled += await this.applier.apply(ownerKey, page.changes);
          summary.cursor = page.nextCursor;
          await this.outbox.setPullCursor(ownerKey, summary.cursor);
          if (!page.hasMore) break;
        }
        await this.outbox.markLastSynced(ownerKey);
      } catch (caught) {
        networkFailure = caught instanceof Error ? caught.message : 'Could not pull cloud changes.';
      }
    }

    const pendingCount = await this.outbox.pendingCount(ownerKey);
    const blockedCount = await this.outbox.blockedCount(ownerKey);
    const lastSyncedAt = await this.outbox.lastSyncedAt(ownerKey);
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
