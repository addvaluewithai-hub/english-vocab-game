import { describe, expect, it } from 'vitest';
import { levelFitScore, rankImportCandidate } from '@/imports/ranking';

describe('import ranking', () => {
  it('prefers vocabulary near the learner level while allowing one level above', () => {
    expect(levelFitScore('B1', 'B1')).toBe(1);
    expect(levelFitScore('B2', 'B1')).toBeGreaterThan(levelFitScore('C1', 'B1'));
    expect(levelFitScore('A2', 'B1')).toBeGreaterThan(levelFitScore('C2', 'B1'));
  });

  it('deprioritizes mastered vocabulary without deleting the candidate', () => {
    const fresh = rankImportCandidate({
      usefulness: 0.9,
      confidence: 0.9,
      cefrLevel: 'B1',
      duplicateKind: 'NONE',
      knownLifecycle: null,
    }, 'B1');
    const mastered = rankImportCandidate({
      usefulness: 0.9,
      confidence: 0.9,
      cefrLevel: 'B1',
      duplicateKind: 'NONE',
      knownLifecycle: 'MASTERED',
    }, 'B1');
    expect(fresh.recommended).toBe(true);
    expect(mastered.recommended).toBe(false);
    expect(mastered.score).toBeLessThan(fresh.score);
    expect(mastered.reason).toContain('already strong');
  });

  it('keeps a possible new sense eligible instead of blindly merging it', () => {
    const rank = rankImportCandidate({
      usefulness: 0.86,
      confidence: 0.92,
      cefrLevel: 'B2',
      duplicateKind: 'TERM_ONLY',
      knownLifecycle: null,
    }, 'B1');
    expect(rank.recommended).toBe(true);
    expect(rank.reason).toContain('possible new sense');
  });

  it('marks exact duplicates as source-only optional work rather than a new card recommendation', () => {
    const rank = rankImportCandidate({
      usefulness: 1,
      confidence: 1,
      cefrLevel: 'B1',
      duplicateKind: 'EXACT',
      knownLifecycle: 'MASTERED',
    }, 'B1');
    expect(rank.recommended).toBe(false);
    expect(rank.reason).toContain('already in bank');
  });
});
