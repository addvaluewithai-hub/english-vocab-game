import type { SQLiteDatabase } from 'expo-sqlite';
import type { LanguagePair } from '@/domain/types';
import { createId } from '@/utils/id';
import { asSqlDatabase, type SqlDatabase } from './database';

export const GUEST_OWNER_KEY = 'guest';

export interface AppPreferences {
  activeOwnerKey: string;
  activeLanguagePairId: string | null;
  reduceMotionOverride: boolean | null;
}

type LanguagePairRow = {
  id: string;
  target_language_code: string;
  target_language_name: string;
  reference_language_code: string;
  reference_language_name: string;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
  owner_key: string;
};

function mapPair(row: LanguagePairRow): LanguagePair {
  return {
    id: row.id,
    targetLanguageCode: row.target_language_code,
    targetLanguageName: row.target_language_name,
    referenceLanguageCode: row.reference_language_code,
    referenceLanguageName: row.reference_language_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    deletedAt: row.deleted_at,
  };
}

export class PreferencesRepository {
  constructor(private readonly db: SqlDatabase) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key);
    return row?.value ?? null;
  }

  async set(key: string, value: string, now = new Date()): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO app_settings(key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      key,
      value,
      now.toISOString(),
    );
  }

  async load(): Promise<AppPreferences> {
    const [activeOwnerKey, activeLanguagePairId, motion] = await Promise.all([
      this.get('active_owner_key'),
      this.get('active_language_pair_id'),
      this.get('reduce_motion_override'),
    ]);
    return {
      activeOwnerKey: activeOwnerKey ?? GUEST_OWNER_KEY,
      activeLanguagePairId,
      reduceMotionOverride: motion === null ? null : motion === 'true',
    };
  }

  async listLanguagePairs(ownerKey: string): Promise<LanguagePair[]> {
    const rows = await this.db.getAllAsync<LanguagePairRow>(
      `SELECT * FROM language_pairs
       WHERE owner_key = ? AND deleted_at IS NULL
       ORDER BY created_at ASC, id ASC`,
      ownerKey,
    );
    return rows.map(mapPair);
  }

  async createLanguagePair(input: {
    ownerKey: string;
    targetLanguageCode: string;
    targetLanguageName: string;
    referenceLanguageCode: string;
    referenceLanguageName: string;
  }, now = new Date()): Promise<LanguagePair> {
    const timestamp = now.toISOString();
    const pair: LanguagePair = {
      id: createId('language-pair'),
      targetLanguageCode: input.targetLanguageCode.trim().toLowerCase(),
      targetLanguageName: input.targetLanguageName.trim(),
      referenceLanguageCode: input.referenceLanguageCode.trim().toLowerCase(),
      referenceLanguageName: input.referenceLanguageName.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      deletedAt: null,
    };
    await this.db.runAsync(
      `INSERT INTO language_pairs (
        id, target_language_code, target_language_name, reference_language_code, reference_language_name,
        created_at, updated_at, version, deleted_at, owner_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      pair.id,
      pair.targetLanguageCode,
      pair.targetLanguageName,
      pair.referenceLanguageCode,
      pair.referenceLanguageName,
      pair.createdAt,
      pair.updatedAt,
      pair.version,
      input.ownerKey,
    );
    return pair;
  }
}

export async function claimGuestLanguagePairs(db: SQLiteDatabase, userId: string, now = new Date()): Promise<number> {
  const sql = asSqlDatabase(db);
  const preferences = new PreferencesRepository(sql);
  const existingClaim = await preferences.get('guest_claimed_by');
  if (existingClaim === userId) return 0;
  if (existingClaim && existingClaim !== userId) {
    throw new Error('Guest data on this device has already been claimed by another account.');
  }

  let changed = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const result = await txn.runAsync(
      `UPDATE language_pairs SET owner_key = ?, updated_at = ?, version = version + 1
       WHERE owner_key = ? AND deleted_at IS NULL`,
      userId,
      now.toISOString(),
      GUEST_OWNER_KEY,
    );
    changed = result.changes;
    const txPreferences = new PreferencesRepository(asSqlDatabase(txn));
    await txPreferences.set('guest_claimed_by', userId, now);
    await txPreferences.set('active_owner_key', userId, now);
  });
  return changed;
}
