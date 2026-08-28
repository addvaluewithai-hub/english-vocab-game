import { getNeonClient } from '@/cloud/neon-client';
import type {
  PendingSyncMutation,
  PullSyncPage,
  PushMutationResult,
  RemoteSyncEntity,
  SyncEntityType,
  SyncTransport,
} from './types';

const ID_TABLES = new Set<SyncEntityType>([
  'language_pairs', 'terms', 'senses', 'cards', 'collections', 'sources',
  'source_occurrences', 'review_events',
]);

function cloudPayload(mutation: PendingSyncMutation): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ...mutation.payload,
    owner_id: mutation.ownerKey,
  };
  delete payload.owner_key;
  if (mutation.entityType === 'collection_items') delete payload.updated_at;
  if (mutation.entityType === 'app_settings') {
    delete payload.created_at;
    delete payload.deleted_at;
  }
  return payload;
}

function versionOf(row: Record<string, unknown>): number {
  const value = Number(row.version ?? 1);
  return Number.isFinite(value) ? value : 1;
}

function sameVersionPayload(
  remote: Record<string, unknown>,
  incoming: Record<string, unknown>,
): boolean {
  for (const [key, value] of Object.entries(incoming)) {
    if (key === 'owner_id') continue;
    if (JSON.stringify(remote[key] ?? null) !== JSON.stringify(value ?? null)) return false;
  }
  return true;
}

function splitCollectionItemId(entityId: string): [string, string] | null {
  const separator = entityId.indexOf(':');
  if (separator <= 0 || separator >= entityId.length - 1) return null;
  return [entityId.slice(0, separator), entityId.slice(separator + 1)];
}

async function selectEntity(
  entityType: SyncEntityType,
  entityId: string,
): Promise<Record<string, unknown> | null> {
  const client = getNeonClient();
  let query = client.from(entityType).select('*');

  if (ID_TABLES.has(entityType)) {
    query = query.eq('id', entityId);
  } else if (entityType === 'user_card_states') {
    query = query.eq('card_id', entityId);
  } else if (entityType === 'app_settings') {
    query = query.eq('key', entityId);
  } else {
    const ids = splitCollectionItemId(entityId);
    if (!ids) return null;
    const [collectionId, cardId] = ids;
    query = query.eq('collection_id', collectionId).eq('card_id', cardId);
  }

  const { data, error } = await query.limit(1);
  if (error) throw new Error(`Neon read failed: ${error.message}`);
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows[0] ?? null;
}

async function insertMutation(
  mutation: PendingSyncMutation,
  payload: Record<string, unknown>,
): Promise<PushMutationResult> {
  const { error } = await getNeonClient().from(mutation.entityType).insert(payload);
  if (!error) return { status: 'APPLIED', serverVersion: mutation.entityVersion };

  if (error.code === '23505') {
    const remote = await selectEntity(mutation.entityType, mutation.entityId);
    if (remote && sameVersionPayload(remote, payload)) {
      return { status: 'DUPLICATE', serverVersion: versionOf(remote) };
    }
  }
  return { status: 'REJECTED', code: error.code ?? 'NEON_INSERT', message: error.message };
}

export class NeonDataApiSyncTransport implements SyncTransport {
  async pushMutation(
    ownerKey: string,
    _clientId: string,
    mutation: PendingSyncMutation,
  ): Promise<PushMutationResult> {
    if (ownerKey !== mutation.ownerKey) {
      return { status: 'REJECTED', code: 'OWNER_MISMATCH', message: 'Mutation owner does not match the active account.' };
    }

    const payload = cloudPayload(mutation);
    if (mutation.operation === 'APPEND' || mutation.entityVersion <= 1) {
      return insertMutation(mutation, payload);
    }

    const remote = await selectEntity(mutation.entityType, mutation.entityId);
    if (!remote) return insertMutation(mutation, payload);

    const remoteVersion = versionOf(remote);
    if (remoteVersion === mutation.entityVersion && sameVersionPayload(remote, payload)) {
      return { status: 'DUPLICATE', serverVersion: remoteVersion };
    }
    if (remoteVersion !== mutation.entityVersion - 1) {
      return {
        status: 'CONFLICT',
        remote: {
          entityType: mutation.entityType,
          entityId: mutation.entityId,
          entityVersion: remoteVersion,
          operation: remote.deleted_at ? 'DELETE' : 'UPSERT',
          payload: remote,
          cursor: 0,
        },
      };
    }

    let update = getNeonClient()
      .from(mutation.entityType)
      .update(payload)
      .eq('owner_id', ownerKey)
      .eq('version', remoteVersion);

    if (ID_TABLES.has(mutation.entityType)) update = update.eq('id', mutation.entityId);
    else if (mutation.entityType === 'user_card_states') update = update.eq('card_id', mutation.entityId);
    else if (mutation.entityType === 'app_settings') update = update.eq('key', mutation.entityId);
    else {
      const collectionId = String(mutation.payload.collection_id ?? '');
      const cardId = String(mutation.payload.card_id ?? '');
      update = update.eq('collection_id', collectionId).eq('card_id', cardId);
    }

    const { data, error } = await update.select('*');
    if (error) return { status: 'REJECTED', code: error.code ?? 'NEON_UPDATE', message: error.message };
    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) {
      const latest = await selectEntity(mutation.entityType, mutation.entityId);
      if (!latest) return { status: 'REJECTED', code: 'MISSING_REMOTE', message: 'Remote entity disappeared during sync.' };
      return {
        status: 'CONFLICT',
        remote: {
          entityType: mutation.entityType,
          entityId: mutation.entityId,
          entityVersion: versionOf(latest),
          operation: latest.deleted_at ? 'DELETE' : 'UPSERT',
          payload: latest,
          cursor: 0,
        },
      };
    }
    return { status: 'APPLIED', serverVersion: mutation.entityVersion };
  }

  async pullChanges(
    ownerKey: string,
    _clientId: string,
    afterCursor: number,
    limit: number,
  ): Promise<PullSyncPage> {
    const { data, error } = await getNeonClient()
      .from('sync_changes')
      .select('cursor,entity_type,entity_id,entity_version,operation')
      .eq('owner_id', ownerKey)
      .gt('cursor', afterCursor)
      .order('cursor', { ascending: true })
      .limit(limit);
    if (error) throw new Error(`Neon change pull failed: ${error.message}`);

    const changeRows = (data ?? []) as {
      cursor: number;
      entity_type: SyncEntityType;
      entity_id: string;
      entity_version: number;
      operation: RemoteSyncEntity['operation'];
    }[];
    const changes: RemoteSyncEntity[] = [];
    for (const change of changeRows) {
      const payload = await selectEntity(change.entity_type, change.entity_id);
      if (!payload) continue;
      changes.push({
        entityType: change.entity_type,
        entityId: change.entity_id,
        entityVersion: Number(change.entity_version),
        operation: change.operation,
        payload,
        cursor: Number(change.cursor),
      });
    }
    return {
      changes,
      nextCursor: Number(changeRows.at(-1)?.cursor ?? afterCursor),
      hasMore: changeRows.length === limit,
    };
  }
}
