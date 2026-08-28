export type LearnerLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type KnownLifecycle = 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED' | null;

const LEVEL_INDEX: Record<LearnerLevel, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
  B2: 3,
  C1: 4,
  C2: 5,
};

export const DEFAULT_LEARNER_LEVEL: LearnerLevel = 'B1';

export function isLearnerLevel(value: unknown): value is LearnerLevel {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEVEL_INDEX, value);
}

export function levelFitScore(candidateLevel: LearnerLevel | null, learnerLevel: LearnerLevel): number {
  if (!candidateLevel) return 0.55;
  const distance = LEVEL_INDEX[candidateLevel] - LEVEL_INDEX[learnerLevel];
  if (distance === 0) return 1;
  if (distance === 1) return 0.92;
  if (distance === -1) return 0.82;
  if (distance === 2) return 0.62;
  if (distance === -2) return 0.5;
  return 0.3;
}

export interface CandidateRankInput {
  usefulness: number | null;
  confidence: number | null;
  cefrLevel: LearnerLevel | null;
  duplicateKind: 'NONE' | 'EXACT' | 'TERM_ONLY';
  knownLifecycle: KnownLifecycle;
}

export interface CandidateRank {
  score: number;
  recommended: boolean;
  reason: string;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function rankImportCandidate(input: CandidateRankInput, learnerLevel: LearnerLevel): CandidateRank {
  const usefulness = input.usefulness ?? 0.55;
  const confidence = input.confidence ?? 0.55;
  const levelFit = levelFitScore(input.cefrLevel, learnerLevel);

  let score = usefulness * 0.5 + confidence * 0.25 + levelFit * 0.25;
  const reasons: string[] = [];

  if (input.cefrLevel) reasons.push(`${input.cefrLevel} fit`);
  if (usefulness >= 0.8) reasons.push('high usefulness');
  if (confidence < 0.58) reasons.push('low confidence');

  if (input.duplicateKind === 'EXACT') {
    score -= 0.8;
    reasons.push('already in bank');
  } else if (input.duplicateKind === 'TERM_ONLY') {
    score -= 0.05;
    reasons.push('possible new sense');
  }

  if (input.knownLifecycle === 'MASTERED') {
    score -= 0.45;
    reasons.push('already strong');
  } else if (input.knownLifecycle === 'REVIEW') {
    score -= 0.12;
    reasons.push('already learning');
  }

  score = clamp(score);
  const recommended = input.duplicateKind !== 'EXACT'
    && input.knownLifecycle !== 'MASTERED'
    && confidence >= 0.5
    && score >= 0.58;

  if (reasons.length === 0) reasons.push('context candidate');
  return { score, recommended, reason: reasons.join(' · ') };
}
