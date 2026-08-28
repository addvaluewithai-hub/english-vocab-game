import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs';
import type { ISODateString, ReviewEvent, ReviewGrade, StudyLifecycle, UserCardState } from '@/domain/types';

export interface ScheduleDecision {
  lifecycle: StudyLifecycle;
  repetitions: number;
  lapses: number;
  nextDueAt: ISODateString;
  stability?: number;
  difficulty?: number;
  elapsedDays?: number;
  scheduledDays?: number;
  learningSteps?: number;
  fsrsState?: number;
  schedulerVersion?: string;
}

export interface ReviewScheduler {
  schedule(
    previous: UserCardState | null,
    grade: ReviewGrade,
    reviewedAt: Date,
    history?: readonly ReviewEvent[],
  ): ScheduleDecision;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const SUCCESS_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60] as const;

export class SimpleReviewScheduler implements ReviewScheduler {
  schedule(previous: UserCardState | null, grade: ReviewGrade, reviewedAt: Date): ScheduleDecision {
    if (grade === 'FORGOT') {
      return {
        lifecycle: 'LEARNING',
        repetitions: 0,
        lapses: (previous?.lapses ?? 0) + 1,
        nextDueAt: new Date(reviewedAt.getTime() + 10 * MINUTE_MS).toISOString(),
      };
    }

    const repetitions = (previous?.repetitions ?? 0) + 1;
    const intervalIndex = Math.min(repetitions - 1, SUCCESS_INTERVAL_DAYS.length - 1);
    const intervalDays = SUCCESS_INTERVAL_DAYS[intervalIndex] ?? 60;
    return {
      lifecycle: repetitions >= 2 ? 'REVIEW' : 'LEARNING',
      repetitions,
      lapses: previous?.lapses ?? 0,
      nextDueAt: new Date(reviewedAt.getTime() + intervalDays * DAY_MS).toISOString(),
    };
  }
}

const FSRS_VERSION = 'fsrs-5.4.1';
const fsrsScheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
});

function lifecycleFor(state: State): StudyLifecycle {
  if (state === State.New) return 'NEW';
  if (state === State.Review) return 'REVIEW';
  return 'LEARNING';
}

function ratingFor(grade: ReviewGrade): Rating {
  return grade === 'KNEW' ? Rating.Good : Rating.Again;
}

export class FsrsReviewScheduler implements ReviewScheduler {
  schedule(
    previous: UserCardState | null,
    grade: ReviewGrade,
    reviewedAt: Date,
    history: readonly ReviewEvent[] = [],
  ): ScheduleDecision {
    const ordered = [...history].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt) || a.id.localeCompare(b.id));
    const replay = ordered.length > 0
      ? ordered
      : [{ id: 'current', cardId: previous?.cardId ?? '', sessionId: '', grade, reviewedAt: reviewedAt.toISOString(), responseMs: null } satisfies ReviewEvent];
    let card = createEmptyCard(new Date(replay[0]?.reviewedAt ?? reviewedAt));

    for (const event of replay) {
      card = fsrsScheduler.next(card, new Date(event.reviewedAt), ratingFor(event.grade)).card;
    }

    return {
      lifecycle: lifecycleFor(card.state),
      repetitions: card.reps,
      lapses: card.lapses,
      nextDueAt: card.due.toISOString(),
      stability: card.stability,
      difficulty: card.difficulty,
      elapsedDays: card.elapsed_days,
      scheduledDays: card.scheduled_days,
      learningSteps: card.learning_steps,
      fsrsState: card.state,
      schedulerVersion: FSRS_VERSION,
    };
  }
}
