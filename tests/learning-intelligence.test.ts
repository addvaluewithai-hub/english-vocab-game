import { describe, expect, it } from 'vitest';
import type { ReviewEvent, StudyCard } from '@/domain/types';
import { recommendEnrichment } from '@/enrichment/rules';
import { importIdempotencyKey } from '@/imports/jobs';
import { isValidReminderTime, nextReminderDate } from '@/notifications/review-reminders';
import { buildLearningInsight, retentionRate } from '@/stats/metrics';
import { availableRecallModes, clozeSentence, gradeTypedAnswer } from '@/study/recall-modes';
import { FsrsReviewScheduler } from '@/study/scheduler';

function card(overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    cardId: 'card-1',
    termId: 'term-1',
    senseId: 'sense-1',
    targetLanguageCode: 'en',
    referenceLanguageCode: 'ar',
    term: 'look forward to',
    termKind: 'PHRASE',
    translation: 'يتطلع إلى',
    definition: 'to feel pleased and excited about something that is going to happen',
    partOfSpeech: 'phrase',
    note: null,
    imageUri: null,
    audioUri: null,
    contextSentence: 'I look forward to seeing you.',
    sourceTitle: null,
    sourceType: null,
    sourcePageNumber: null,
    sourceTimestampSeconds: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    state: null,
    ...overrides,
  };
}

const history: ReviewEvent[] = [
  { id: 'r1', cardId: 'card-1', sessionId: 's1', grade: 'KNEW', reviewedAt: '2026-08-01T10:00:00.000Z', responseMs: 1200 },
  { id: 'r2', cardId: 'card-1', sessionId: 's2', grade: 'FORGOT', reviewedAt: '2026-08-04T10:00:00.000Z', responseMs: 1800 },
  { id: 'r3', cardId: 'card-1', sessionId: 's3', grade: 'KNEW', reviewedAt: '2026-08-04T10:10:00.000Z', responseMs: 900 },
];

describe('learning intelligence', () => {
  it('replays identical review histories deterministically through FSRS', () => {
    const scheduler = new FsrsReviewScheduler();
    const at = new Date('2026-08-04T10:10:00.000Z');
    const first = scheduler.schedule(null, 'KNEW', at, history);
    const second = scheduler.schedule(null, 'KNEW', at, [...history].reverse());
    expect(second).toEqual(first);
    expect(first.schedulerVersion).toBe('fsrs-5.4.1');
    expect(new Date(first.nextDueAt).getTime()).toBeGreaterThan(at.getTime());
  });

  it('only exposes recall modes supported by available content', () => {
    const noAudio = availableRecallModes(card());
    expect(noAudio).toContain('CLOZE');
    expect(noAudio).not.toContain('LISTENING');
    const withAudio = availableRecallModes(card({ audioUri: 'https://example.test/audio.mp3' }));
    expect(withAudio).toContain('LISTENING');
  });

  it('builds cloze prompts and grades typed answers without punctuation noise', () => {
    expect(clozeSentence(card())).toBe('I _____ seeing you.');
    expect(gradeTypedAnswer(card({ term: 'Hello!' }), ' hello ')).toBe(true);
    expect(gradeTypedAnswer(card({ term: 'Hello!' }), 'goodbye')).toBe(false);
  });

  it('computes explainable retention and due-first advice', () => {
    expect(retentionRate(8, 2)).toBe(0.8);
    expect(retentionRate(0, 0)).toBeNull();
    expect(buildLearningInsight({ dueNow: 3, retention30Days: 0.9, reviewed30Days: 10 })).toContain('3 cards are due now');
  });

  it('validates reminder times and rolls past times to the next day', () => {
    expect(isValidReminderTime('19:30')).toBe(true);
    expect(isValidReminderTime('25:00')).toBe(false);
    const next = nextReminderDate('19:00', new Date(2026, 7, 28, 20, 0, 0));
    expect(next.getDate()).toBe(29);
    expect(next.getHours()).toBe(19);
  });

  it('does not recommend an image for a noun without explicit visual concreteness', () => {
    const abstractNoun = recommendEnrichment({
      termKind: 'WORD',
      partOfSpeech: 'noun',
      definition: null,
      contextSentence: null,
      imageUri: null,
      audioUri: null,
    });
    expect(abstractNoun.some((item) => item.kind === 'IMAGE')).toBe(false);
    const concreteNoun = recommendEnrichment({
      termKind: 'WORD',
      partOfSpeech: 'noun',
      definition: null,
      contextSentence: null,
      imageUri: null,
      audioUri: null,
      isVisuallyConcrete: true,
    });
    expect(concreteNoun[0]?.kind).toBe('IMAGE');
  });

  it('creates stable source-level import idempotency keys', () => {
    const first = importIdempotencyKey({ languagePairId: 'pair-1', sourceType: 'YOUTUBE', sourceFingerprint: '  VIDEO:ABC  ' });
    const second = importIdempotencyKey({ languagePairId: 'pair-1', sourceType: 'YOUTUBE', sourceFingerprint: 'video:abc' });
    expect(first).toBe(second);
  });
});
