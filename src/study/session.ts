import type { ReviewEvent, ReviewGrade, ReviewMode, ReviewModeResult, StudyCard, UserCardState } from '@/domain/types';
import { createId } from '@/utils/id';
import type { ReviewScheduler } from './scheduler';

export interface StudyDataSource {
  listStudyCandidates(): Promise<StudyCard[]>;
}
export interface ReviewEventStore {
  append(value: ReviewEvent): Promise<boolean>;
  listForCard?(cardId: string): Promise<ReviewEvent[]>;
}
export interface CardStateStore {
  get(cardId: string): Promise<UserCardState | null>;
  upsert(value: UserCardState): Promise<void>;
}
export interface StudyQueueItem {
  queueId: string;
  card: StudyCard;
  isRetry: boolean;
}
export interface SessionSummary {
  knew: number;
  forgot: number;
  reviewed: number;
  retries: number;
}
export interface StudySessionSnapshot {
  sessionId: string;
  current: StudyQueueItem | null;
  completed: boolean;
  initialTotal: number;
  plannedTotal: number;
  reviewedCount: number;
  remainingCount: number;
  summary: SessionSummary;
}
export interface ReviewSubmissionMeta {
  recallMode?: ReviewMode;
  modeResult?: ReviewModeResult;
}

function isDue(card: StudyCard, now: Date): boolean {
  if (!card.state || !card.state.nextDueAt) return true;
  return new Date(card.state.nextDueAt).getTime() <= now.getTime();
}

function sortCandidates(a: StudyCard, b: StudyCard): number {
  const aIsReview = Boolean(a.state?.nextDueAt);
  const bIsReview = Boolean(b.state?.nextDueAt);
  if (aIsReview !== bIsReview) return aIsReview ? -1 : 1;
  const aOrder = a.state?.nextDueAt ?? a.createdAt;
  const bOrder = b.state?.nextDueAt ?? b.createdAt;
  return aOrder.localeCompare(bOrder) || a.cardId.localeCompare(b.cardId);
}

export class StudySession {
  private cursor = 0;
  private readonly queue: StudyQueueItem[];
  private readonly retriedCards = new Set<string>();
  private summary: SessionSummary = { knew: 0, forgot: 0, reviewed: 0, retries: 0 };

  constructor(
    readonly sessionId: string,
    initialCards: StudyCard[],
    private readonly events: ReviewEventStore,
    private readonly states: CardStateStore,
    private readonly scheduler: ReviewScheduler,
  ) {
    this.queue = initialCards.map((card, index) => ({
      queueId: `${sessionId}:initial:${index}:${card.cardId}`,
      card,
      isRetry: false,
    }));
  }

  get snapshot(): StudySessionSnapshot {
    const current = this.queue[this.cursor] ?? null;
    return {
      sessionId: this.sessionId,
      current,
      completed: current === null,
      initialTotal: this.queue.filter((item) => !item.isRetry).length,
      plannedTotal: this.queue.length,
      reviewedCount: this.cursor,
      remainingCount: Math.max(0, this.queue.length - this.cursor),
      summary: { ...this.summary },
    };
  }

  async gradeCurrent(
    grade: ReviewGrade,
    responseMs: number | null,
    now = new Date(),
    meta: ReviewSubmissionMeta = {},
  ): Promise<boolean> {
    const item = this.queue[this.cursor];
    if (!item) return false;

    const event: ReviewEvent = {
      id: `review:${item.queueId}`,
      cardId: item.card.cardId,
      sessionId: this.sessionId,
      grade,
      reviewedAt: now.toISOString(),
      responseMs,
      recallMode: meta.recallMode ?? 'TARGET_TO_MEANING',
      modeResult: meta.modeResult ?? 'SELF_GRADED',
      schedulerRating: grade === 'KNEW' ? 3 : 1,
    };
    const inserted = await this.events.append(event);
    if (!inserted) return false;

    const previous = await this.states.get(item.card.cardId);
    const history = this.events.listForCard ? await this.events.listForCard(item.card.cardId) : [event];
    const decision = this.scheduler.schedule(previous, grade, now, history);
    const timestamp = now.toISOString();
    await this.states.upsert({
      cardId: item.card.cardId,
      lifecycle: decision.lifecycle,
      repetitions: decision.repetitions,
      lapses: decision.lapses,
      lastReviewedAt: timestamp,
      nextDueAt: decision.nextDueAt,
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
      version: (previous?.version ?? 0) + 1,
      stability: decision.stability ?? previous?.stability,
      difficulty: decision.difficulty ?? previous?.difficulty,
      elapsedDays: decision.elapsedDays ?? previous?.elapsedDays,
      scheduledDays: decision.scheduledDays ?? previous?.scheduledDays,
      learningSteps: decision.learningSteps ?? previous?.learningSteps,
      fsrsState: decision.fsrsState ?? previous?.fsrsState,
      schedulerVersion: decision.schedulerVersion ?? previous?.schedulerVersion,
    });

    this.summary.reviewed += 1;
    if (grade === 'KNEW') this.summary.knew += 1;
    else this.summary.forgot += 1;

    if (grade === 'FORGOT' && !item.isRetry && !this.retriedCards.has(item.card.cardId)) {
      this.retriedCards.add(item.card.cardId);
      this.summary.retries += 1;
      this.queue.push({ queueId: `${this.sessionId}:retry:${item.card.cardId}`, card: item.card, isRetry: true });
    }

    this.cursor += 1;
    return true;
  }
}

export class StudySessionService {
  constructor(
    private readonly source: StudyDataSource,
    private readonly events: ReviewEventStore,
    private readonly states: CardStateStore,
    private readonly scheduler: ReviewScheduler,
  ) {}

  private async dueCandidates(now: Date): Promise<StudyCard[]> {
    const candidates = await this.source.listStudyCandidates();
    return candidates.filter((card) => isDue(card, now)).sort(sortCandidates);
  }

  async countDue(now = new Date()): Promise<number> {
    return (await this.dueCandidates(now)).length;
  }

  async createSession(now = new Date(), limit?: number): Promise<StudySession> {
    const due = await this.dueCandidates(now);
    const capped = typeof limit === 'number' && Number.isFinite(limit) && limit > 0
      ? due.slice(0, Math.floor(limit))
      : due;
    return new StudySession(createId('session'), capped, this.events, this.states, this.scheduler);
  }
}
