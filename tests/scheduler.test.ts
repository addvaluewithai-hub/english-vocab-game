import { describe, expect, it } from 'vitest';
import type { UserCardState } from '@/domain/types';
import { SimpleReviewScheduler } from '@/study/scheduler';

const NOW = new Date('2026-08-28T10:00:00.000Z');
function state(overrides: Partial<UserCardState> = {}): UserCardState {
  return {
    cardId: 'card-1', lifecycle: 'LEARNING', repetitions: 1, lapses: 0,
    lastReviewedAt: '2026-08-27T10:00:00.000Z', nextDueAt: '2026-08-28T10:00:00.000Z',
    createdAt: '2026-08-20T10:00:00.000Z', updatedAt: '2026-08-27T10:00:00.000Z', version: 1,
    ...overrides,
  };
}

describe('SimpleReviewScheduler', () => {
  const scheduler = new SimpleReviewScheduler();
  it('schedules a first success for the next day', () => {
    const result = scheduler.schedule(null, 'KNEW', NOW);
    expect(result.lifecycle).toBe('LEARNING');
    expect(result.repetitions).toBe(1);
    expect(result.nextDueAt).toBe('2026-08-29T10:00:00.000Z');
  });
  it('moves repeated success into review with a longer interval', () => {
    const result = scheduler.schedule(state(), 'KNEW', NOW);
    expect(result.lifecycle).toBe('REVIEW');
    expect(result.repetitions).toBe(2);
    expect(result.nextDueAt).toBe('2026-08-31T10:00:00.000Z');
  });
  it('turns a lapse into learning and schedules a short retry', () => {
    const result = scheduler.schedule(state({ lifecycle: 'REVIEW', repetitions: 4, lapses: 2 }), 'FORGOT', NOW);
    expect(result.lifecycle).toBe('LEARNING');
    expect(result.repetitions).toBe(0);
    expect(result.lapses).toBe(3);
    expect(result.nextDueAt).toBe('2026-08-28T10:10:00.000Z');
  });
});
