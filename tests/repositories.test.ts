import { describe, expect, it } from 'vitest';
import type { SQLiteBindValue, SQLiteRunResult } from 'expo-sqlite';
import { ReviewEventRepository } from '@/data/repositories';
import type { SqlDatabase } from '@/data/database';
import type { ReviewEvent } from '@/domain/types';

class RecordingDatabase implements SqlDatabase {
  private ids = new Set<string>();
  execAsync = async () => {};
  getFirstAsync = async <T,>() => null as T | null;
  getAllAsync = async <T,>() => [] as T[];
  runAsync = async (_source: string, ...params: SQLiteBindValue[]): Promise<SQLiteRunResult> => {
    const id = String(params[0]); const changes = this.ids.has(id) ? 0 : 1; this.ids.add(id); return { changes, lastInsertRowId: 0 };
  };
}

describe('ReviewEventRepository', () => {
  it('exposes idempotent append without an update/delete API', async () => {
    const repository = new ReviewEventRepository(new RecordingDatabase());
    const event: ReviewEvent = { id: 'review-1', cardId: 'card-1', sessionId: 'session-1', grade: 'KNEW', reviewedAt: '2026-08-28T00:00:00.000Z', responseMs: 800 };
    expect(await repository.append(event)).toBe(true);
    expect(await repository.append(event)).toBe(false);
    expect('update' in repository).toBe(false);
    expect('delete' in repository).toBe(false);
  });
});
