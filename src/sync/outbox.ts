import type { SqlDatabase } from '@/data/database';
import { retryDelayMs } from './protocol';
import type { PendingSyncMutation, SyncEntityType } from './types';

interface OutboxRow {
  id: string;
  owner_key: string;
  entity_type: SyncEntityType;
  entity_id: string;
  operation: PendingSyncMutation['operation'];
  entity_version: number;
  payload_json: string;
  created_at: string;
  attempt_count: number;
  next_attempt_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
}

function parsePayload(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Sync outbox payload must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function mapRow(row: OutboxRow): PendingSyncMutation {
  return {
    id: row.id,
    ownerKey: row.owner_key,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation,
    entityVersion: row.entity_version,
    payload: parsePayload(row.payload_json),
    createdAt: row.created_at,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
  };
}

export class SyncOutboxRepository {
  constructor(private readonly db: SqlDatabase) {}

  async listDue(ownerKey: string, now = new Date(), limit = 50): Promise<PendingSyncMutation[]> {
    const rows = await this.db.getAllAsync<OutboxRow>(
      `SELECT id, owner_key, entity_type, entity_id, operation, entity_version, payload_json,
              created_at, attempt_count, next_attempt_at, last_error_code, last_error_message
       FROM sync_outbox
       WHERE owner_key = ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
       ORDER BY created_at ASC, id ASC
       LIMIT ?`,
      ownerKey,
      now.toISOString(),
      limit,
    );
    return rows.map(mapRow);
  }

  async pendingCount(ownerKey: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM sync_outbox WHERE owner_key = ?',
      ownerKey,
    );
    return row?.count ?? 0;
  }

  async blockedCount(ownerKey: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM sync_dead_letters WHERE owner_key = ?',
      ownerKey,
    );
    return row?.count ?? 0;
  }

  async acknowledge(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM sync_outbox WHERE id = ?', id);
  }

  async defer(
    mutation: PendingSyncMutation,
    code: string,
    message: string,
    now = new Date(),
    random01 = 0.5,
  ): Promise<void> {
    const nextAttempt = new Date(
      now.getTime() + retryDelayMs(mutation.attemptCount, random01),
    ).toISOString();
    await this.db.runAsync(
      `UPDATE sync_outbox
       SET attempt_count = attempt_count + 1, next_attempt_at = ?, last_error_code = ?, last_error_message = ?
       WHERE id = ?`,
      nextAttempt,
      code,
      message.slice(0, 500),
      mutation.id,
    );
  }

  async quarantine(
    mutation: PendingSyncMutation,
    code: string,
    message: string,
    now = new Date(),
  ): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO sync_dead_letters(
        id, owner_key, entity_type, entity_id, operation, entity_version, payload_json,
        created_at, failed_at, error_code, error_message
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      mutation.id,
      mutation.ownerKey,
      mutation.entityType,
      mutation.entityId,
      mutation.operation,
      mutation.entityVersion,
      JSON.stringify(mutation.payload),
      mutation.createdAt,
      now.toISOString(),
      code,
      message.slice(0, 500),
    );
    await this.acknowledge(mutation.id);
  }

  async listBlocked(ownerKey: string): Promise<PendingSyncMutation[]> {
    const rows = await this.db.getAllAsync<OutboxRow>(
      `SELECT id, owner_key, entity_type, entity_id, operation, entity_version, payload_json,
              created_at, 0 AS attempt_count, NULL AS next_attempt_at,
              error_code AS last_error_code, error_message AS last_error_message
       FROM sync_dead_letters WHERE owner_key = ? ORDER BY failed_at DESC, id ASC`,
      ownerKey,
    );
    return rows.map(mapRow);
  }

  async retryBlocked(id: string, now = new Date()): Promise<boolean> {
    const row = await this.db.getFirstAsync<OutboxRow>(
      `SELECT id, owner_key, entity_type, entity_id, operation, entity_version, payload_json,
              created_at, 0 AS attempt_count, NULL AS next_attempt_at, error_code AS last_error_code,
              error_message AS last_error_message
       FROM sync_dead_letters WHERE id = ?`,
      id,
    );
    if (!row) return false;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO sync_outbox(
        id, owner_key, entity_type, entity_id, operation, entity_version, payload_json,
        created_at, attempt_count, next_attempt_at, last_error_code, last_error_message
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL)`,
      row.id,
      row.owner_key,
      row.entity_type,
      row.entity_id,
      row.operation,
      row.entity_version,
      row.payload_json,
      row.created_at,
      now.toISOString(),
    );
    await this.db.runAsync('DELETE FROM sync_dead_letters WHERE id = ?', id);
    return true;
  }

  async rebaseOnRemote(
    mutation: PendingSyncMutation,
    remoteVersion: number,
    now = new Date(),
  ): Promise<PendingSyncMutation> {
    const nextVersion = remoteVersion + 1;
    const nextPayload = { ...mutation.payload, version: nextVersion, updated_at: now.toISOString() };
    const nextId = `${mutation.entityType}:${mutation.entityId}:${nextVersion}:${mutation.operation}`;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO sync_outbox(
        id, owner_key, entity_type, entity_id, operation, entity_version, payload_json,
        created_at, attempt_count, next_attempt_at, last_error_code, last_error_message
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL)`,
      nextId,
      mutation.ownerKey,
      mutation.entityType,
      mutation.entityId,
      mutation.operation,
      nextVersion,
      JSON.stringify(nextPayload),
      mutation.createdAt,
    );
    if (nextId !== mutation.id) await this.acknowledge(mutation.id);
    return { ...mutation, id: nextId, entityVersion: nextVersion, payload: nextPayload, attemptCount: 0, nextAttemptAt: null, lastErrorCode: null, lastErrorMessage: null };
  }

  async pullCursor(ownerKey: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_meta WHERE key = ?',
      `pull_cursor:${ownerKey}`,
    );
    const parsed = Number(row?.value ?? '0');
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  }

  async setPullCursor(ownerKey: string, cursor: number, now = new Date()): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO sync_meta(key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      `pull_cursor:${ownerKey}`,
      String(cursor),
      now.toISOString(),
    );
  }

  async markLastSynced(ownerKey: string, now = new Date()): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO sync_meta(key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      `last_synced_at:${ownerKey}`,
      now.toISOString(),
      now.toISOString(),
    );
  }

  async lastSyncedAt(ownerKey: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_meta WHERE key = ?',
      `last_synced_at:${ownerKey}`,
    );
    return row?.value ?? null;
  }
}
