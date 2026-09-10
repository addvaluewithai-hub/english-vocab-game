import type { SQLiteDatabase } from 'expo-sqlite';

export async function initializeMahandDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS mahand_hard_words (
      item_id TEXT PRIMARY KEY NOT NULL,
      added_at TEXT NOT NULL
    );
  `);
}

async function ensureTable(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS mahand_hard_words (
      item_id TEXT PRIMARY KEY NOT NULL,
      added_at TEXT NOT NULL
    );
  `);
}

export async function listHardWordIds(db: SQLiteDatabase): Promise<string[]> {
  await ensureTable(db);
  const rows = await db.getAllAsync<{ item_id: string }>(
    `SELECT item_id FROM mahand_hard_words ORDER BY added_at DESC`,
  );
  return rows.map((row) => row.item_id);
}

export async function addHardWord(db: SQLiteDatabase, itemId: string): Promise<void> {
  await ensureTable(db);
  await db.runAsync(
    `INSERT OR IGNORE INTO mahand_hard_words(item_id, added_at) VALUES (?, ?)`,
    itemId,
    new Date().toISOString(),
  );
}

export async function removeHardWord(db: SQLiteDatabase, itemId: string): Promise<void> {
  await ensureTable(db);
  await db.runAsync(`DELETE FROM mahand_hard_words WHERE item_id = ?`, itemId);
}
