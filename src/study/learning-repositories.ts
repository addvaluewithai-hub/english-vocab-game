import type { SqlDatabase } from '@/data/database';
import type { ReviewEvent, UserCardState } from '@/domain/types';
import type { CardStateStore, ReviewEventStore } from './session';

export class LearningCardStateRepository implements CardStateStore {
  constructor(private readonly db: SqlDatabase) {}

  async get(cardId: string): Promise<UserCardState | null> {
    const row = await this.db.getFirstAsync<{
      card_id: string;
      lifecycle: UserCardState['lifecycle'];
      repetitions: number;
      lapses: number;
      last_reviewed_at: string | null;
      next_due_at: string | null;
      created_at: string;
      updated_at: string;
      version: number;
      stability: number;
      difficulty: number;
      elapsed_days: number;
      scheduled_days: number;
      learning_steps: number;
      fsrs_state: number;
      scheduler_version: string;
    }>('SELECT * FROM user_card_states WHERE card_id = ?', cardId);
    if (!row) return null;
    return {
      cardId: row.card_id,
      lifecycle: row.lifecycle,
      repetitions: row.repetitions,
      lapses: row.lapses,
      lastReviewedAt: row.last_reviewed_at,
      nextDueAt: row.next_due_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
      stability: row.stability,
      difficulty: row.difficulty,
      elapsedDays: row.elapsed_days,
      scheduledDays: row.scheduled_days,
      learningSteps: row.learning_steps,
      fsrsState: row.fsrs_state,
      schedulerVersion: row.scheduler_version,
    };
  }

  async upsert(value: UserCardState): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO user_card_states(
        card_id,lifecycle,repetitions,lapses,last_reviewed_at,next_due_at,created_at,updated_at,version,
        stability,difficulty,elapsed_days,scheduled_days,learning_steps,fsrs_state,scheduler_version
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(card_id) DO UPDATE SET
        lifecycle=excluded.lifecycle,repetitions=excluded.repetitions,lapses=excluded.lapses,
        last_reviewed_at=excluded.last_reviewed_at,next_due_at=excluded.next_due_at,updated_at=excluded.updated_at,
        version=excluded.version,stability=excluded.stability,difficulty=excluded.difficulty,
        elapsed_days=excluded.elapsed_days,scheduled_days=excluded.scheduled_days,learning_steps=excluded.learning_steps,
        fsrs_state=excluded.fsrs_state,scheduler_version=excluded.scheduler_version`,
      value.cardId,
      value.lifecycle,
      value.repetitions,
      value.lapses,
      value.lastReviewedAt,
      value.nextDueAt,
      value.createdAt,
      value.updatedAt,
      value.version,
      value.stability ?? 0,
      value.difficulty ?? 0,
      value.elapsedDays ?? 0,
      value.scheduledDays ?? 0,
      value.learningSteps ?? 0,
      value.fsrsState ?? 0,
      value.schedulerVersion ?? 'simple-v1',
    );
  }
}

export class LearningReviewEventRepository implements ReviewEventStore {
  constructor(private readonly db: SqlDatabase) {}

  async append(value: ReviewEvent): Promise<boolean> {
    const result = await this.db.runAsync(
      `INSERT OR IGNORE INTO review_events(
        id,card_id,session_id,grade,reviewed_at,response_ms,recall_mode,mode_result,scheduler_rating
      ) VALUES(?,?,?,?,?,?,?,?,?)`,
      value.id,
      value.cardId,
      value.sessionId,
      value.grade,
      value.reviewedAt,
      value.responseMs,
      value.recallMode ?? 'TARGET_TO_MEANING',
      value.modeResult ?? 'SELF_GRADED',
      value.schedulerRating ?? (value.grade === 'KNEW' ? 3 : 1),
    );
    return result.changes === 1;
  }

  async listForCard(cardId: string): Promise<ReviewEvent[]> {
    const rows = await this.db.getAllAsync<{
      id: string;
      card_id: string;
      session_id: string;
      grade: ReviewEvent['grade'];
      reviewed_at: string;
      response_ms: number | null;
      recall_mode: NonNullable<ReviewEvent['recallMode']>;
      mode_result: NonNullable<ReviewEvent['modeResult']>;
      scheduler_rating: number | null;
    }>(`SELECT id,card_id,session_id,grade,reviewed_at,response_ms,recall_mode,mode_result,scheduler_rating
        FROM review_events WHERE card_id=? ORDER BY reviewed_at ASC,id ASC`, cardId);
    return rows.map((row) => ({
      id: row.id,
      cardId: row.card_id,
      sessionId: row.session_id,
      grade: row.grade,
      reviewedAt: row.reviewed_at,
      responseMs: row.response_ms,
      recallMode: row.recall_mode,
      modeResult: row.mode_result,
      schedulerRating: row.scheduler_rating,
    }));
  }
}
