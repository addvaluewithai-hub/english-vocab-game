import { describe, expect, it } from 'vitest';
import {
  SyncEngineCore,
  type SyncChangeApplierPort,
  type SyncOutboxPort,
  type SyncStatusPort,
} from '@/sync/core';
import type {
  PendingSyncMutation,
  PullSyncPage,
  PushMutationResult,
  RemoteSyncEntity,
  SyncSnapshot,
  SyncTransport,
} from '@/sync/types';

const OWNER = 'user-1';
const CLIENT = 'device-a';

function mutation(overrides: Partial<PendingSyncMutation> = {}): PendingSyncMutation {
  return {
    id: 'terms:term-1:1:UPSERT',
    ownerKey: OWNER,
    entityType: 'terms',
    entityId: 'term-1',
    operation: 'UPSERT',
    entityVersion: 1,
    payload: {
      id: 'term-1',
      language_pair_id: 'pair-1',
      text: 'car',
      normalized_text: 'car',
      kind: 'WORD',
      created_at: '2026-08-28T10:00:00.000Z',
      updated_at: '2026-08-28T10:00:00.000Z',
      version: 1,
      deleted_at: null,
    },
    createdAt: '2026-08-28T10:00:00.000Z',
    attemptCount: 0,
    nextAttemptAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    ...overrides,
  };
}

class MemoryOutbox implements SyncOutboxPort {
  pending: PendingSyncMutation[];
  blocked: PendingSyncMutation[] = [];
  cursor = 0;
  lastSynced: string | null = null;

  constructor(initial: PendingSyncMutation[] = []) {
    this.pending = [...initial];
  }

  async pullCursor(): Promise<number> { return this.cursor; }
  async pendingCount(): Promise<number> { return this.pending.length; }
  async blockedCount(): Promise<number> { return this.blocked.length; }
  async listDue(_ownerKey: string, _now: Date, limit: number): Promise<PendingSyncMutation[]> {
    return this.pending.slice(0, limit);
  }
  async acknowledge(id: string): Promise<void> {
    this.pending = this.pending.filter((item) => item.id !== id);
  }
  async defer(value: PendingSyncMutation, code: string, message: string): Promise<void> {
    this.pending = this.pending.map((item) => item.id === value.id
      ? { ...item, attemptCount: item.attemptCount + 1, lastErrorCode: code, lastErrorMessage: message }
      : item);
  }
  async quarantine(value: PendingSyncMutation, code: string, message: string): Promise<void> {
    this.blocked.push({ ...value, lastErrorCode: code, lastErrorMessage: message });
    await this.acknowledge(value.id);
  }
  async rebaseOnRemote(value: PendingSyncMutation, remoteVersion: number): Promise<PendingSyncMutation> {
    const nextVersion = remoteVersion + 1;
    const next = {
      ...value,
      id: `${value.entityType}:${value.entityId}:${nextVersion}:${value.operation}`,
      entityVersion: nextVersion,
      payload: { ...value.payload, version: nextVersion },
    };
    this.pending = this.pending.map((item) => item.id === value.id ? next : item);
    return next;
  }
  async setPullCursor(_ownerKey: string, cursor: number): Promise<void> { this.cursor = cursor; }
  async markLastSynced(): Promise<void> { this.lastSynced = '2026-08-28T12:00:00.000Z'; }
  async lastSyncedAt(): Promise<string | null> { return this.lastSynced; }
}

class MemoryApplier implements SyncChangeApplierPort {
  private versions = new Map<string, number>();
  applied: RemoteSyncEntity[] = [];

  async apply(_ownerKey: string, changes: RemoteSyncEntity[]): Promise<number> {
    let count = 0;
    for (const change of changes) {
      const key = `${change.entityType}:${change.entityId}`;
      const current = this.versions.get(key) ?? 0;
      if (change.entityVersion <= current) continue;
      this.versions.set(key, change.entityVersion);
      this.applied.push(change);
      count += 1;
    }
    return count;
  }
}

class MemoryStatus implements SyncStatusPort {
  snapshot: SyncSnapshot = {
    phase: 'IDLE',
    pendingCount: 0,
    blockedCount: 0,
    lastSyncedAt: null,
    lastError: null,
  };
  update(patch: Partial<SyncSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
  }
}

class ToggleTransport implements SyncTransport {
  online = false;
  readonly pushed: PendingSyncMutation[] = [];
  pages: PullSyncPage[] = [];
  pushResult?: (value: PendingSyncMutation) => PushMutationResult;

  async pushMutation(_ownerKey: string, _clientId: string, value: PendingSyncMutation): Promise<PushMutationResult> {
    if (!this.online) throw new Error('offline');
    this.pushed.push(value);
    return this.pushResult?.(value) ?? { status: 'APPLIED', serverVersion: value.entityVersion };
  }

  async pullChanges(_ownerKey: string, _clientId: string, afterCursor: number): Promise<PullSyncPage> {
    if (!this.online) throw new Error('offline');
    return this.pages.shift() ?? { changes: [], nextCursor: afterCursor, hasMore: false };
  }
}

function core(
  transport: SyncTransport,
  outbox: MemoryOutbox,
  applier = new MemoryApplier(),
  status = new MemoryStatus(),
): { engine: SyncEngineCore; applier: MemoryApplier; status: MemoryStatus } {
  return {
    engine: new SyncEngineCore(transport, outbox, applier, status, async () => undefined),
    applier,
    status,
  };
}

describe('offline sync engine integration', () => {
  it('keeps offline create/edit mutations across restart and flushes them after reconnect', async () => {
    const created = mutation();
    const edited = mutation({
      id: 'terms:term-1:2:UPSERT',
      entityVersion: 2,
      payload: { ...created.payload, text: 'automobile', normalized_text: 'automobile', version: 2, updated_at: '2026-08-28T11:00:00.000Z' },
      createdAt: '2026-08-28T11:00:00.000Z',
    });
    const outbox = new MemoryOutbox([created, edited]);
    const transport = new ToggleTransport();
    const first = core(transport, outbox);

    const offline = await first.engine.run(OWNER, CLIENT);
    expect(offline.deferred).toBe(1);
    expect(outbox.pending).toHaveLength(2);
    expect(first.status.snapshot.phase).toBe('OFFLINE');

    transport.online = true;
    const restarted = core(transport, outbox);
    const synced = await restarted.engine.run(OWNER, CLIENT);
    expect(synced.pushed).toBe(2);
    expect(outbox.pending).toHaveLength(0);
    expect(transport.pushed.map((item) => item.entityVersion)).toEqual([1, 2]);
    expect(restarted.status.snapshot.phase).toBe('IDLE');
  });

  it('treats a repeated append-only review event as acknowledged instead of duplicating it', async () => {
    const review = mutation({
      id: 'review_events:review-1:1:APPEND',
      entityType: 'review_events',
      entityId: 'review-1',
      operation: 'APPEND',
      payload: { id: 'review-1', card_id: 'card-1', session_id: 's1', grade: 'KNEW', reviewed_at: '2026-08-28T10:00:00.000Z' },
    });
    const outbox = new MemoryOutbox([review]);
    const transport = new ToggleTransport();
    transport.online = true;
    transport.pushResult = (value) => ({ status: 'DUPLICATE', serverVersion: value.entityVersion });

    const { engine } = core(transport, outbox);
    const result = await engine.run(OWNER, CLIENT);
    expect(result.pushed).toBe(1);
    expect(outbox.pending).toHaveLength(0);
  });

  it('pulls remote changes from the stored cursor and advances the checkpoint', async () => {
    const remote: RemoteSyncEntity = {
      entityType: 'terms',
      entityId: 'term-remote',
      entityVersion: 3,
      operation: 'UPSERT',
      payload: { id: 'term-remote', owner_id: OWNER, version: 3, updated_at: '2026-08-28T12:00:00.000Z' },
      cursor: 42,
    };
    const outbox = new MemoryOutbox();
    outbox.cursor = 41;
    const transport = new ToggleTransport();
    transport.online = true;
    transport.pages = [{ changes: [remote], nextCursor: 42, hasMore: false }];

    const { engine, applier } = core(transport, outbox);
    const result = await engine.run(OWNER, CLIENT);
    expect(result.pulled).toBe(1);
    expect(result.cursor).toBe(42);
    expect(outbox.cursor).toBe(42);
    expect(applier.applied.map((item) => item.entityId)).toEqual(['term-remote']);
  });

  it('quarantines a permanent bad mutation without blocking later valid changes', async () => {
    const bad = mutation({ id: 'terms:bad:1:UPSERT', entityId: 'bad' });
    const good = mutation({ id: 'terms:good:1:UPSERT', entityId: 'good', createdAt: '2026-08-28T10:01:00.000Z' });
    const outbox = new MemoryOutbox([bad, good]);
    const transport = new ToggleTransport();
    transport.online = true;
    transport.pushResult = (value) => value.entityId === 'bad'
      ? { status: 'REJECTED', code: 'VALIDATION', message: 'invalid payload' }
      : { status: 'APPLIED', serverVersion: value.entityVersion };

    const { engine, status } = core(transport, outbox);
    const result = await engine.run(OWNER, CLIENT);
    expect(result.blocked).toBe(1);
    expect(result.pushed).toBe(1);
    expect(outbox.pending).toHaveLength(0);
    expect(outbox.blocked.map((item) => item.entityId)).toEqual(['bad']);
    expect(status.snapshot.phase).toBe('ERROR');
  });
});
