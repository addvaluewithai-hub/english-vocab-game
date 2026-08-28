import type { SQLiteBindValue, SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';

export interface SqlDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SQLiteBindValue[]): Promise<SQLiteRunResult>;
  getFirstAsync<T>(source: string, ...params: SQLiteBindValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: SQLiteBindValue[]): Promise<T[]>;
}

export function asSqlDatabase(db: SQLiteDatabase): SqlDatabase {
  return db;
}
