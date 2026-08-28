import type { SQLiteDatabase } from 'expo-sqlite';
import { migrateDatabase } from './migrations';
import { ensureDemoSeedIfEmpty } from './seed';

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await migrateDatabase(db);
  await ensureDemoSeedIfEmpty(db);
}
