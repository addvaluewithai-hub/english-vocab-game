import type { SQLiteDatabase } from 'expo-sqlite';

export interface LearningStats {
  totalCards: number;
  dueNow: number;
  newCards: number;
  learningCards: number;
  strongCards: number;
  reviewedToday: number;
  reviewed30Days: number;
  remembered30Days: number;
  forgotten30Days: number;
  retention30Days: number | null;
  activeDays7: number;
  insight: string;
}

interface CountRow { count: number }
interface GradeRow { grade: 'KNEW' | 'FORGOT'; count: number }

export function retentionRate(remembered: number, forgotten: number): number | null {
  const total = remembered + forgotten;
  return total === 0 ? null : remembered / total;
}

export function buildLearningInsight(input: Pick<LearningStats, 'dueNow' | 'retention30Days' | 'reviewed30Days'>): string {
  if (input.dueNow > 0) {
    return `${input.dueNow} ${input.dueNow === 1 ? 'card is' : 'cards are'} due now. Reviewing due material first protects retention better than adding more new words.`;
  }
  if (input.reviewed30Days === 0) {
    return 'Your bank is ready. Complete a few reviews and this page will start showing retention trends.';
  }
  if (input.retention30Days !== null && input.retention30Days < 0.75) {
    return 'You are caught up, but recent recall is fragile. Short, frequent review sessions are likely to help more than a large new batch.';
  }
  return 'You are caught up and recent recall is holding well. Add new material when you are ready, without sacrificing due reviews.';
}

function isoDaysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function count(sqlite: SQLiteDatabase, sql: string, ...params: (string | number)[]): Promise<number> {
  const row = await sqlite.getFirstAsync<CountRow>(sql, ...params);
  return Number(row?.count ?? 0);
}

export async function loadLearningStats(
  sqlite: SQLiteDatabase,
  languagePairId: string,
  now = new Date(),
): Promise<LearningStats> {
  const nowIso = now.toISOString();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = isoDaysAgo(now, 30);
  const sevenDaysAgo = isoDaysAgo(now, 7);
  const pairCardJoin = `FROM cards c JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id WHERE t.language_pair_id=? AND c.deleted_at IS NULL AND s.deleted_at IS NULL AND t.deleted_at IS NULL`;

  const [totalCards, newCards, learningCards, strongCards, dueNow, reviewedToday, reviewed30Days, activeDays7] = await Promise.all([
    count(sqlite, `SELECT COUNT(*) count ${pairCardJoin}`, languagePairId),
    count(sqlite, `SELECT COUNT(*) count FROM cards c JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id LEFT JOIN user_card_states u ON u.card_id=c.id WHERE t.language_pair_id=? AND c.deleted_at IS NULL AND (u.card_id IS NULL OR u.lifecycle='NEW')`, languagePairId),
    count(sqlite, `SELECT COUNT(*) count FROM user_card_states u JOIN cards c ON c.id=u.card_id JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id WHERE t.language_pair_id=? AND c.deleted_at IS NULL AND u.lifecycle='LEARNING'`, languagePairId),
    count(sqlite, `SELECT COUNT(*) count FROM user_card_states u JOIN cards c ON c.id=u.card_id JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id WHERE t.language_pair_id=? AND c.deleted_at IS NULL AND u.lifecycle IN ('REVIEW','MASTERED')`, languagePairId),
    count(sqlite, `SELECT COUNT(*) count FROM cards c JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id LEFT JOIN user_card_states u ON u.card_id=c.id WHERE t.language_pair_id=? AND c.deleted_at IS NULL AND (u.card_id IS NULL OR u.next_due_at IS NULL OR u.next_due_at<=?)`, languagePairId, nowIso),
    count(sqlite, `SELECT COUNT(*) count FROM review_events r JOIN cards c ON c.id=r.card_id JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id WHERE t.language_pair_id=? AND r.reviewed_at>=?`, languagePairId, todayStart.toISOString()),
    count(sqlite, `SELECT COUNT(*) count FROM review_events r JOIN cards c ON c.id=r.card_id JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id WHERE t.language_pair_id=? AND r.reviewed_at>=?`, languagePairId, thirtyDaysAgo),
    count(sqlite, `SELECT COUNT(DISTINCT substr(r.reviewed_at,1,10)) count FROM review_events r JOIN cards c ON c.id=r.card_id JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id WHERE t.language_pair_id=? AND r.reviewed_at>=?`, languagePairId, sevenDaysAgo),
  ]);

  const gradeRows = await sqlite.getAllAsync<GradeRow>(
    `SELECT r.grade grade, COUNT(*) count FROM review_events r
     JOIN cards c ON c.id=r.card_id JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id
     WHERE t.language_pair_id=? AND r.reviewed_at>=? GROUP BY r.grade`,
    languagePairId,
    thirtyDaysAgo,
  );
  const remembered30Days = Number(gradeRows.find((row) => row.grade === 'KNEW')?.count ?? 0);
  const forgotten30Days = Number(gradeRows.find((row) => row.grade === 'FORGOT')?.count ?? 0);
  const retention30Days = retentionRate(remembered30Days, forgotten30Days);
  const base = {
    totalCards,
    dueNow,
    newCards,
    learningCards,
    strongCards,
    reviewedToday,
    reviewed30Days,
    remembered30Days,
    forgotten30Days,
    retention30Days,
    activeDays7,
  };
  return { ...base, insight: buildLearningInsight(base) };
}
