import { describe, expect, it } from 'vitest';
import type { SQLiteDatabase } from 'expo-sqlite';
import { LATEST_DATABASE_VERSION, migrateDatabase } from '@/data/migrations';

class FakeDatabase {
  userVersion = 0;
  executed: string[] = [];
  async execAsync(sql: string) { this.executed.push(sql); const match = sql.match(/PRAGMA user_version = (\d+)/); if (match?.[1]) this.userVersion = Number(match[1]); }
  async getFirstAsync<T>(sql: string): Promise<T | null> { if (sql === 'PRAGMA user_version') return { user_version: this.userVersion } as T; return null; }
  async withExclusiveTransactionAsync(task: (txn: FakeDatabase) => Promise<void>) { await task(this); }
}

describe('migrateDatabase', () => {
  it('creates the latest schema from a fresh database and is repeatable', async () => {
    const db = new FakeDatabase();
    await migrateDatabase(db as unknown as SQLiteDatabase);
    expect(db.userVersion).toBe(LATEST_DATABASE_VERSION);
    const firstRunCount = db.executed.length;
    await migrateDatabase(db as unknown as SQLiteDatabase);
    expect(db.userVersion).toBe(LATEST_DATABASE_VERSION);
    expect(db.executed.length).toBe(firstRunCount + 1);
  });
});
