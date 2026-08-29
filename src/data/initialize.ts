import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { migrateDatabase } from './migrations';
import { ensureDemoSeedIfEmpty } from './seed';

type ExclusiveTransactionTask = Parameters<SQLiteDatabase['withExclusiveTransactionAsync']>[0];
type ExclusiveTransaction = Parameters<ExclusiveTransactionTask>[0];

function installWebExclusiveTransactionFallback(db: SQLiteDatabase): void {
  if (Platform.OS !== 'web') return;

  db.withExclusiveTransactionAsync = async (task: ExclusiveTransactionTask): Promise<void> => {
    await db.withTransactionAsync(async () => {
      await task(db as unknown as ExclusiveTransaction);
    });
  };
}

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  // Expo SQLite does not support withExclusiveTransactionAsync on web.
  // Install a database-instance fallback once so every feature using this
  // shared connection keeps transactional behavior in hosted previews.
  installWebExclusiveTransactionFallback(db);
  await migrateDatabase(db);
  await ensureDemoSeedIfEmpty(db);
}
