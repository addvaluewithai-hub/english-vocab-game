import type { SQLiteDatabase } from 'expo-sqlite';
import type { ReviewGrade } from '@/domain/types';

async function ensureTable(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS mahand_unit_results (
      item_id TEXT PRIMARY KEY NOT NULL,
      unit_id TEXT NOT NULL,
      grade TEXT NOT NULL CHECK (grade IN ('KNEW', 'FORGOT')),
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mahand_unit_results_unit_grade
      ON mahand_unit_results(unit_id, grade);
  `);
}

export async function recordUnitGrade(
  db: SQLiteDatabase,
  unitId: string,
  itemId: string,
  grade: ReviewGrade,
): Promise<void> {
  await ensureTable(db);
  await db.runAsync(
    `INSERT INTO mahand_unit_results(item_id, unit_id, grade, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET
       unit_id = excluded.unit_id,
       grade = excluded.grade,
       updated_at = excluded.updated_at`,
    itemId,
    unitId,
    grade,
    new Date().toISOString(),
  );
}

export async function listForgottenWordIds(db: SQLiteDatabase, unitId: string): Promise<string[]> {
  await ensureTable(db);
  const rows = await db.getAllAsync<{ item_id: string }>(
    `SELECT item_id
     FROM mahand_unit_results
     WHERE unit_id = ? AND grade = 'FORGOT'
     ORDER BY updated_at DESC`,
    unitId,
  );
  return rows.map((row) => row.item_id);
}

export async function listForgottenCountsByUnit(db: SQLiteDatabase): Promise<Record<string, number>> {
  await ensureTable(db);
  const rows = await db.getAllAsync<{ unit_id: string; count: number }>(
    `SELECT unit_id, COUNT(*) AS count
     FROM mahand_unit_results
     WHERE grade = 'FORGOT'
     GROUP BY unit_id`,
  );
  return Object.fromEntries(rows.map((row) => [row.unit_id, row.count]));
}
