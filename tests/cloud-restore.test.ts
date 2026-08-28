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

const OWNER = 'user-restore';

type AppliedKey = `${string}:${string}:${number}`;

class MemoryOutbox implements SyncOutboxPort {
  cursor = 0;
  lastSyncedAtValue: string | null = null;

  constructor(public pending: PendingSyncMutation[] = []) {}

  async pullCursor(): Promise<number> { return this.cursor; }
  async pendingCount(): Promise<number> { return this.pending.length; }
  async blockedCount(): Promise<number> { return 0; }
  async listDue(_ownerKey: string, _now: Date, limit: number): Promise<PendingSyncMutation[]> {
    return this.pending.slice(0, limit);
  }
  async acknowledge(id: string): Promise<void> {
    this.pending = this.pending.filter((item) => item.id !== id);
  }
  async defer(value: PendingSyncMutation): Promise<void> {
    this.pending = this.pending.map((item) => item.id === value.id
      ? { ...item, attemptCount: item.attemptCount + 1 }
      : item);
  }
  async quarantine(value: PendingSyncMutation): Promise<void> {
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
  async markLastSynced(): Promise<void> { this.lastSyncedAtValue = '2026-08-28T18:00:00.000Z'; }
  async lastSyncedAt(): Promise<string | null> { return this.lastSyncedAtValue; }
}

class MemoryApplier implements SyncChangeApplierPort {
  private readonly seen = new Set<AppliedKey>();
  readonly rows = new Map<string, RemoteSyncEntity>();

  async apply(_ownerKey: string, changes: RemoteSyncEntity[]): Promise<number> {
    let applied = 0;
    for (const change of changes) {
      const versionKey: AppliedKey = `${change.entityType}:${change.entityId}:${change.entityVersion}`;
      if (this.seen.has(versionKey)) continue;
      this.seen.add(versionKey);
      const entityKey = `${change.entityType}:${change.entityId}`;
      const existing = this.rows.get(entityKey);
      if (existing && existing.entityVersion > change.entityVersion) continue;
      this.rows.set(entityKey, change);
      applied += 1;
    }
    return applied;
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

class SharedCloud implements SyncTransport {
  private cursor = 0;
  private readonly byMutationId = new Map<string, RemoteSyncEntity>();
  private readonly log: RemoteSyncEntity[] = [];

  seed(changes: Omit<RemoteSyncEntity, 'cursor'>[]): void {
    for (const change of changes) this.append(change);
  }

  private append(change: Omit<RemoteSyncEntity, 'cursor'>): RemoteSyncEntity {
    this.cursor += 1;
    const remote = { ...change, cursor: this.cursor };
    this.log.push(remote);
    return remote;
  }

  async pushMutation(
    _ownerKey: string,
    _clientId: string,
    mutation: PendingSyncMutation,
  ): Promise<PushMutationResult> {
    const existing = this.byMutationId.get(mutation.id);
    if (existing) return { status: 'DUPLICATE', serverVersion: existing.entityVersion };
    const remote = this.append({
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      entityVersion: mutation.entityVersion,
      operation: mutation.operation,
      payload: mutation.payload,
    });
    this.byMutationId.set(mutation.id, remote);
    return { status: 'APPLIED', serverVersion: mutation.entityVersion };
  }

  async pullChanges(
    _ownerKey: string,
    _clientId: string,
    afterCursor: number,
    limit: number,
  ): Promise<PullSyncPage> {
    const changes = this.log.filter((item) => item.cursor > afterCursor).slice(0, limit);
    const nextCursor = changes.at(-1)?.cursor ?? afterCursor;
    return {
      changes,
      nextCursor,
      hasMore: this.log.some((item) => item.cursor > nextCursor),
    };
  }
}

function reviewMutation(id: string, cardId: string, clientId: string): PendingSyncMutation {
  const reviewedAt = clientId === 'device-a'
    ? '2026-08-28T17:00:00.000Z'
    : '2026-08-28T17:03:00.000Z';
  return {
    id: `review_events:${id}:1:APPEND`,
    ownerKey: OWNER,
    entityType: 'review_events',
    entityId: id,
    operation: 'APPEND',
    entityVersion: 1,
    payload: {
      id,
      card_id: cardId,
      session_id: `session-${clientId}`,
      grade: 'KNEW',
      reviewed_at: reviewedAt,
      response_ms: 900,
      recall_mode: 'TARGET_TO_MEANING',
    },
    createdAt: reviewedAt,
    attemptCount: 0,
    nextAttemptAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  };
}

function engine(
  cloud: SharedCloud,
  outbox: MemoryOutbox,
  applier: MemoryApplier,
  clientId: string,
): SyncEngineCore {
  return new SyncEngineCore(
    cloud,
    outbox,
    applier,
    new MemoryStatus(),
    async () => undefined,
  );
}

describe('cloud restore and multi-device convergence', () => {
  it('reconstructs a fresh device from the cloud starting at cursor zero', async () => {
    const cloud = new SharedCloud();
    cloud.seed([
      {
        entityType: 'language_pairs',
        entityId: 'pair-1',
        entityVersion: 1,
        operation: 'UPSERT',
        payload: { id: 'pair-1', owner_id: OWNER, target_language_code: 'en', reference_language_code: 'ar', version: 1 },
      },
      {
        entityType: 'terms',
        entityId: 'term-1',
        entityVersion: 1,
        operation: 'UPSERT',
        payload: { id: 'term-1', language_pair_id: 'pair-1', text: 'car', normalized_text: 'car', kind: 'WORD', version: 1 },
      },
      {
        entityType: 'senses',
        entityId: 'sense-1',
        entityVersion: 1,
        operation: 'UPSERT',
        payload: { id: 'sense-1', term_id: 'term-1', translation: 'سيارة', version: 1 },
      },
      {
        entityType: 'cards',
        entityId: 'card-1',
        entityVersion: 1,
        operation: 'UPSERT',
        payload: { id: 'card-1', sense_id: 'sense-1', prompt_mode: 'TARGET_TO_MEANING', version: 1 },
      },
      {
        entityType: 'review_events',
        entityId: 'review-cloud-1',
        entityVersion: 1,
        operation: 'APPEND',
        payload: { id: 'review-cloud-1', card_id: 'card-1', grade: 'KNEW', reviewed_at: '2026-08-28T16:00:00.000Z' },
      },
    ]);

    const outbox = new MemoryOutbox();
    const applier = new MemoryApplier();
    const result = await engine(cloud, outbox, applier, 'fresh-device').run(OWNER, 'fresh-device');

    expect(result.pulled).toBe(5);
    expect(outbox.cursor).toBe(5);
    expect(applier.rows.has('language_pairs:pair-1')).toBe(true);
    expect(applier.rows.has('terms:term-1')).toBe(true);
    expect(applier.rows.has('senses:sense-1')).toBe(true);
    expect(applier.rows.has('cards:card-1')).toBe(true);
    expect(applier.rows.has('review_events:review-cloud-1')).toBe(true);
  });

  it('converges two devices after independent offline review events without duplicates', async () => {
    const cloud = new SharedCloud();
    const outboxA = new MemoryOutbox([reviewMutation('review-a', 'card-1', 'device-a')]);
    const outboxB = new MemoryOutbox([reviewMutation('review-b', 'card-1', 'device-b')]);
    const applierA = new MemoryApplier();
    const applierB = new MemoryApplier();

    await engine(cloud, outboxA, applierA, 'device-a').run(OWNER, 'device-a');
    await engine(cloud, outboxB, applierB, 'device-b').run(OWNER, 'device-b');
    await engine(cloud, outboxA, applierA, 'device-a').run(OWNER, 'device-a');

    expect(outboxA.pending).toHaveLength(0);
    expect(outboxB.pending).toHaveLength(0);
    expect(applierA.rows.has('review_events:review-a')).toBe(true);
    expect(applierA.rows.has('review_events:review-b')).toBe(true);
    expect(applierB.rows.has('review_events:review-a')).toBe(true);
    expect(applierB.rows.has('review_events:review-b')).toBe(true);
    expect([...applierA.rows.keys()].filter((key) => key.startsWith('review_events:'))).toHaveLength(2);
    expect([...applierB.rows.keys()].filter((key) => key.startsWith('review_events:'))).toHaveLength(2);
  });
});
