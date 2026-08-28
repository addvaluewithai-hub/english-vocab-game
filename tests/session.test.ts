import { describe, expect, it } from 'vitest';
import type { ReviewEvent, StudyCard, UserCardState } from '@/domain/types';
import { SimpleReviewScheduler } from '@/study/scheduler';
import { StudySessionService } from '@/study/session';

function card(id: string, due: string | null, createdAt = '2026-08-01T00:00:00.000Z'): StudyCard {
  return {
    cardId: id, termId: `term-${id}`, senseId: `sense-${id}`, targetLanguageCode: 'en', referenceLanguageCode: 'ar',
    term: id, termKind: 'WORD', translation: `meaning-${id}`, definition: null, partOfSpeech: null, note: null, imageUri: null, audioUri: null,
    contextSentence: null, sourceTitle: null, sourceType: null, sourcePageNumber: null, sourceTimestampSeconds: null, createdAt,
    state: due ? { cardId: id, lifecycle: 'REVIEW', repetitions: 2, lapses: 0, lastReviewedAt: '2026-08-20T00:00:00.000Z', nextDueAt: due, createdAt, updatedAt: '2026-08-20T00:00:00.000Z', version: 2 } : null,
  };
}
class MemoryEvents {
  values: ReviewEvent[] = [];
  async append(value: ReviewEvent) { if (this.values.some((event) => event.id === value.id)) return false; this.values.push(value); return true; }
}
class MemoryStates {
  values = new Map<string, UserCardState>();
  async get(cardId: string) { return this.values.get(cardId) ?? null; }
  async upsert(value: UserCardState) { this.values.set(value.cardId, value); }
}

describe('StudySession', () => {
  it('selects only new and due cards in deterministic order', async () => {
    const source = { async listStudyCandidates() { return [card('future', '2026-09-01T00:00:00.000Z'), card('new', null, '2026-08-03T00:00:00.000Z'), card('overdue', '2026-08-10T00:00:00.000Z')]; } };
    const session = await new StudySessionService(source, new MemoryEvents(), new MemoryStates(), new SimpleReviewScheduler()).createSession(new Date('2026-08-28T00:00:00.000Z'));
    expect(session.snapshot.current?.card.cardId).toBe('overdue');
    expect(session.snapshot.plannedTotal).toBe(2);
  });
  it('adds one same-session retry for a forgotten card and then completes', async () => {
    const events = new MemoryEvents(); const states = new MemoryStates();
    const session = await new StudySessionService({ async listStudyCandidates() { return [card('car', null)]; } }, events, states, new SimpleReviewScheduler()).createSession(new Date('2026-08-28T00:00:00.000Z'));
    expect(await session.gradeCurrent('FORGOT', 1200, new Date('2026-08-28T00:00:00.000Z'))).toBe(true);
    expect(session.snapshot.current?.isRetry).toBe(true);
    expect(session.snapshot.plannedTotal).toBe(2);
    expect(await session.gradeCurrent('FORGOT', 900, new Date('2026-08-28T00:01:00.000Z'))).toBe(true);
    expect(session.snapshot.completed).toBe(true);
    expect(session.snapshot.plannedTotal).toBe(2);
    expect(events.values).toHaveLength(2);
  });
});
