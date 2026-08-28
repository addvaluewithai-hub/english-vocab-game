import type { SQLiteDatabase } from 'expo-sqlite';
import { asSqlDatabase, type SqlDatabase } from '@/data/database';
import type { RemoteSyncEntity, SyncEntityType } from './types';

function text(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string') throw new Error(`Remote ${key} must be text.`);
  return value;
}
function nullableText(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return value === null || value === undefined ? null : String(value);
}
function integer(payload: Record<string, unknown>, key: string, fallback = 1): number {
  const value = Number(payload[key] ?? fallback);
  if (!Number.isFinite(value)) throw new Error(`Remote ${key} must be numeric.`);
  return value;
}

async function localVersion(db: SqlDatabase, change: RemoteSyncEntity): Promise<number | null> {
  let row: { version: number } | null;
  if (change.entityType === 'review_events') {
    const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM review_events WHERE id = ?', change.entityId);
    return existing ? 1 : null;
  }
  if (change.entityType === 'user_card_states') {
    row = await db.getFirstAsync<{ version: number }>('SELECT version FROM user_card_states WHERE card_id = ?', change.entityId);
  } else if (change.entityType === 'app_settings') {
    row = await db.getFirstAsync<{ version: number }>('SELECT version FROM cloud_preferences WHERE owner_key = ? AND key = ?', String(change.payload.owner_id ?? ''), change.entityId);
  } else if (change.entityType === 'collection_items') {
    const collectionId = text(change.payload, 'collection_id');
    const cardId = text(change.payload, 'card_id');
    row = await db.getFirstAsync<{ version: number }>('SELECT version FROM collection_items WHERE collection_id = ? AND card_id = ?', collectionId, cardId);
  } else {
    row = await db.getFirstAsync<{ version: number }>(`SELECT version FROM ${change.entityType} WHERE id = ?`, change.entityId);
  }
  return row?.version ?? null;
}

async function applyOne(db: SqlDatabase, ownerKey: string, change: RemoteSyncEntity): Promise<void> {
  const p = change.payload;
  if (String(p.owner_id ?? ownerKey) !== ownerKey) throw new Error('Remote owner mismatch.');
  const existingVersion = await localVersion(db, change);
  if (existingVersion !== null && existingVersion >= change.entityVersion) return;

  switch (change.entityType) {
    case 'language_pairs':
      await db.runAsync(`INSERT INTO language_pairs(id,target_language_code,target_language_name,reference_language_code,reference_language_name,created_at,updated_at,version,deleted_at,owner_key)
        VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET target_language_code=excluded.target_language_code,target_language_name=excluded.target_language_name,reference_language_code=excluded.reference_language_code,reference_language_name=excluded.reference_language_name,updated_at=excluded.updated_at,version=excluded.version,deleted_at=excluded.deleted_at,owner_key=excluded.owner_key`,
        text(p,'id'),text(p,'target_language_code'),text(p,'target_language_name'),text(p,'reference_language_code'),text(p,'reference_language_name'),text(p,'created_at'),text(p,'updated_at'),integer(p,'version'),nullableText(p,'deleted_at'),ownerKey);
      break;
    case 'terms':
      await db.runAsync(`INSERT INTO terms(id,language_pair_id,text,normalized_text,kind,created_at,updated_at,version,deleted_at) VALUES(?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET language_pair_id=excluded.language_pair_id,text=excluded.text,normalized_text=excluded.normalized_text,kind=excluded.kind,updated_at=excluded.updated_at,version=excluded.version,deleted_at=excluded.deleted_at`,
        text(p,'id'),text(p,'language_pair_id'),text(p,'text'),text(p,'normalized_text'),text(p,'kind'),text(p,'created_at'),text(p,'updated_at'),integer(p,'version'),nullableText(p,'deleted_at'));
      break;
    case 'senses':
      await db.runAsync(`INSERT INTO senses(id,term_id,translation,definition,part_of_speech,note,image_uri,audio_uri,created_at,updated_at,version,deleted_at,pronunciation_text,example_translation) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET term_id=excluded.term_id,translation=excluded.translation,definition=excluded.definition,part_of_speech=excluded.part_of_speech,note=excluded.note,image_uri=excluded.image_uri,audio_uri=excluded.audio_uri,updated_at=excluded.updated_at,version=excluded.version,deleted_at=excluded.deleted_at,pronunciation_text=excluded.pronunciation_text,example_translation=excluded.example_translation`,
        text(p,'id'),text(p,'term_id'),text(p,'translation'),nullableText(p,'definition'),nullableText(p,'part_of_speech'),nullableText(p,'note'),nullableText(p,'image_uri'),nullableText(p,'audio_uri'),text(p,'created_at'),text(p,'updated_at'),integer(p,'version'),nullableText(p,'deleted_at'),nullableText(p,'pronunciation_text'),nullableText(p,'example_translation'));
      break;
    case 'cards':
      await db.runAsync(`INSERT INTO cards(id,sense_id,prompt_mode,created_at,updated_at,version,deleted_at) VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET sense_id=excluded.sense_id,prompt_mode=excluded.prompt_mode,updated_at=excluded.updated_at,version=excluded.version,deleted_at=excluded.deleted_at`,
        text(p,'id'),text(p,'sense_id'),text(p,'prompt_mode'),text(p,'created_at'),text(p,'updated_at'),integer(p,'version'),nullableText(p,'deleted_at'));
      break;
    case 'collections':
      await db.runAsync(`INSERT INTO collections(id,name,description,created_at,updated_at,version,deleted_at,language_pair_id) VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,updated_at=excluded.updated_at,version=excluded.version,deleted_at=excluded.deleted_at,language_pair_id=excluded.language_pair_id`,
        text(p,'id'),text(p,'name'),nullableText(p,'description'),text(p,'created_at'),text(p,'updated_at'),integer(p,'version'),nullableText(p,'deleted_at'),text(p,'language_pair_id'));
      break;
    case 'collection_items':
      await db.runAsync(`INSERT INTO collection_items(collection_id,card_id,created_at,updated_at,version,deleted_at) VALUES(?,?,?,?,?,?)
        ON CONFLICT(collection_id,card_id) DO UPDATE SET updated_at=excluded.updated_at,version=excluded.version,deleted_at=excluded.deleted_at`,
        text(p,'collection_id'),text(p,'card_id'),text(p,'created_at'),nullableText(p,'updated_at') ?? text(p,'created_at'),integer(p,'version'),nullableText(p,'deleted_at'));
      break;
    case 'sources':
      await db.runAsync(`INSERT INTO sources(id,type,title,external_id,uri,created_at,updated_at,version,deleted_at) VALUES(?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET type=excluded.type,title=excluded.title,external_id=excluded.external_id,uri=excluded.uri,updated_at=excluded.updated_at,version=excluded.version,deleted_at=excluded.deleted_at`,
        text(p,'id'),text(p,'type'),nullableText(p,'title'),nullableText(p,'external_id'),nullableText(p,'uri'),text(p,'created_at'),text(p,'updated_at'),integer(p,'version'),nullableText(p,'deleted_at'));
      break;
    case 'source_occurrences':
      await db.runAsync(`INSERT INTO source_occurrences(id,source_id,sense_id,original_sentence,page_number,timestamp_seconds,locator,created_at,updated_at,version,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET source_id=excluded.source_id,sense_id=excluded.sense_id,original_sentence=excluded.original_sentence,page_number=excluded.page_number,timestamp_seconds=excluded.timestamp_seconds,locator=excluded.locator,updated_at=excluded.updated_at,version=excluded.version,deleted_at=excluded.deleted_at`,
        text(p,'id'),text(p,'source_id'),text(p,'sense_id'),nullableText(p,'original_sentence'),p.page_number === null ? null : integer(p,'page_number',0),p.timestamp_seconds === null ? null : Number(p.timestamp_seconds),nullableText(p,'locator'),text(p,'created_at'),text(p,'updated_at'),integer(p,'version'),nullableText(p,'deleted_at'));
      break;
    case 'user_card_states':
      await db.runAsync(`INSERT INTO user_card_states(card_id,lifecycle,repetitions,lapses,last_reviewed_at,next_due_at,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,?)
        ON CONFLICT(card_id) DO UPDATE SET lifecycle=excluded.lifecycle,repetitions=excluded.repetitions,lapses=excluded.lapses,last_reviewed_at=excluded.last_reviewed_at,next_due_at=excluded.next_due_at,updated_at=excluded.updated_at,version=excluded.version`,
        text(p,'card_id'),text(p,'lifecycle'),integer(p,'repetitions',0),integer(p,'lapses',0),nullableText(p,'last_reviewed_at'),nullableText(p,'next_due_at'),text(p,'created_at'),text(p,'updated_at'),integer(p,'version'));
      break;
    case 'review_events':
      await db.runAsync(`INSERT OR IGNORE INTO review_events(id,card_id,session_id,grade,reviewed_at,response_ms) VALUES(?,?,?,?,?,?)`,
        text(p,'id'),text(p,'card_id'),text(p,'session_id'),text(p,'grade'),text(p,'reviewed_at'),p.response_ms === null ? null : integer(p,'response_ms',0));
      break;
    case 'app_settings': {
      const raw = p.value_json;
      const valueJson = typeof raw === 'string' ? raw : JSON.stringify(raw ?? null);
      await db.runAsync(`INSERT INTO cloud_preferences(owner_key,key,value_json,created_at,updated_at,version,deleted_at) VALUES(?,?,?,?,?,?,NULL)
        ON CONFLICT(owner_key,key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at,version=excluded.version,deleted_at=NULL`,
        ownerKey,text(p,'key'),valueJson,text(p,'updated_at'),text(p,'updated_at'),integer(p,'version'));
      break;
    }
  }
}

export class RemoteChangeApplier {
  constructor(private readonly sqlite: SQLiteDatabase) {}

  async apply(ownerKey: string, changes: RemoteSyncEntity[]): Promise<number> {
    if (changes.length === 0) return 0;
    let applied = 0;
    await this.sqlite.withExclusiveTransactionAsync(async (txn) => {
      const db = asSqlDatabase(txn);
      await db.runAsync("UPDATE sync_control SET value='1' WHERE key='suppress_outbox'");
      try {
        for (const change of changes) {
          await applyOne(db, ownerKey, change);
          applied += 1;
        }
      } finally {
        await db.runAsync("UPDATE sync_control SET value='0' WHERE key='suppress_outbox'");
      }
    });
    return applied;
  }
}

export const SYNCABLE_ENTITY_TYPES: readonly SyncEntityType[] = [
  'language_pairs','terms','senses','cards','collections','collection_items','sources',
  'source_occurrences','user_card_states','review_events','app_settings',
];
