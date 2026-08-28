import type { ISODateString, ReviewGrade, StudyLifecycle, UserCardState } from '@/domain/types';

export interface ScheduleDecision {
  lifecycle: StudyLifecycle;
  repetitions: number;
  lapses: number;
  nextDueAt: ISODateString;
}

export interface ReviewScheduler {
  schedule(previous: UserCardState | null, grade: ReviewGrade, reviewedAt: Date): ScheduleDecision;
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
