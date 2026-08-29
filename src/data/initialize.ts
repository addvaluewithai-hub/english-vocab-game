import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { DATABASE_MIGRATIONS, LATEST_DATABASE_VERSION, migrateDatabase } from './migrations';
import { ensureDemoSeedIfEmpty } from './seed';

async function migrateDatabaseForWeb(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  if (currentVersion > LATEST_DATABASE_VERSION) {
    throw new Error(`Database version ${currentVersion} is newer than app version ${LATEST_DATABASE_VERSION}.`);
  }

  for (const migration of DATABASE_MIGRATIONS) {
    if (migration.version <= currentVersion) continue;

    // Expo SQLite does not support withExclusiveTransactionAsync on web.
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    currentVersion = migration.version;
  }
}

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  if (Platform.OS === 'web') {
    await migrateDatabaseForWeb(db);
  } else {
    await migrateDatabase(db);
  }
  await ensureDemoSeedIfEmpty(db);
}
