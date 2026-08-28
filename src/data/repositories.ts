import type {
  Card,
  Collection,
  LanguagePair,
  ReviewEvent,
  Sense,
  Source,
  SourceOccurrence,
  StudyCard,
  Term,
  UserCardState,
} from '@/domain/types';
import type { SqlDatabase } from './database';

type StudyCardRow = {
  card_id: string;
  term_id: string;
  sense_id: string;
  target_language_code: string;
  reference_language_code: string;
  term: string;
  term_kind: 'WORD' | 'PHRASE';
  translation: string;
  definition: string | null;
  part_of_speech: string | null;
  note: string | null;
  image_uri: string | null;
  audio_uri: string | null;
  context_sentence: string | null;
  source_title: string | null;
  source_type: StudyCard['sourceType'];
  source_page_number: number | null;
  source_timestamp_seconds: number | null;
  created_at: string;
  lifecycle: UserCardState['lifecycle'] | null;
  repetitions: number | null;
  lapses: number | null;
  last_reviewed_at: string | null;
  next_due_at: string | null;
  state_created_at: string | null;
  state_updated_at: string | null;
  state_version: number | null;
};

function toStudyCard(row: StudyCardRow): StudyCard {
  const state: UserCardState | null = row.lifecycle
    ? {
        cardId: row.card_id,
        lifecycle: row.lifecycle,
        repetitions: row.repetitions ?? 0,
        lapses: row.lapses ?? 0,
        lastReviewedAt: row.last_reviewed_at,
        nextDueAt: row.next_due_at,
        createdAt: row.state_created_at ?? row.created_at,
        updatedAt: row.state_updated_at ?? row.created_at,
        version: row.state_version ?? 1,
      }
    : null;

  return {
    cardId: row.card_id,
    termId: row.term_id,
    senseId: row.sense_id,
    targetLanguageCode: row.target_language_code,
    referenceLanguageCode: row.reference_language_code,
    term: row.term,
    termKind: row.term_kind,
    translation: row.translation,
    definition: row.definition,
    partOfSpeech: row.part_of_speech,
    note: row.note,
    imageUri: row.image_uri,
    audioUri: row.audio_uri,
    contextSentence: row.context_sentence,
    sourceTitle: row.source_title,
    sourceType: row.source_type,
    sourcePageNumber: row.source_page_number,
    sourceTimestampSeconds: row.source_timestamp_seconds,
    createdAt: row.created_at,
    state,
  };
}

const STUDY_CARD_SELECT = `
SELECT
  c.id AS card_id,
  t.id AS term_id,
  s.id AS sense_id,
  lp.target_language_code,
  lp.reference_language_code,
  t.text AS term,
  t.kind AS term_kind,
  s.translation,
  s.definition,
  s.part_of_speech,
  s.note,
  s.image_uri,
  s.audio_uri,
  so.original_sentence AS context_sentence,
  src.title AS source_title,
  src.type AS source_type,
  so.page_number AS source_page_number,
  so.timestamp_seconds AS source_timestamp_seconds,
  c.created_at,
  ucs.lifecycle,
  ucs.repetitions,
  ucs.lapses,
  ucs.last_reviewed_at,
  ucs.next_due_at,
  ucs.created_at AS state_created_at,
  ucs.updated_at AS state_updated_at,
  ucs.version AS state_version
FROM cards c
JOIN senses s ON s.id = c.sense_id AND s.deleted_at IS NULL
JOIN terms t ON t.id = s.term_id AND t.deleted_at IS NULL
JOIN language_pairs lp ON lp.id = t.language_pair_id AND lp.deleted_at IS NULL
LEFT JOIN user_card_states ucs ON ucs.card_id = c.id
LEFT JOIN source_occurrences so ON so.id = (
  SELECT so2.id FROM source_occurrences so2
  WHERE so2.sense_id = s.id AND so2.deleted_at IS NULL
  ORDER BY so2.created_at ASC, so2.id ASC
  LIMIT 1
)
LEFT JOIN sources src ON src.id = so.source_id AND src.deleted_at IS NULL
WHERE c.deleted_at IS NULL
`;

export class VocabularyRepository {
  constructor(private readonly db: SqlDatabase) {}

  async countCards(): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM cards WHERE deleted_at IS NULL`,
    );
    return row?.count ?? 0;
  }

  async listStudyCandidates(): Promise<StudyCard[]> {
    const rows = await this.db.getAllAsync<StudyCardRow>(
      `${STUDY_CARD_SELECT} ORDER BY c.created_at ASC, c.id ASC`,
    );
    return rows.map(toStudyCard);
  }

  async findStudyCard(cardId: string): Promise<StudyCard | null> {
    const row = await this.db.getFirstAsync<StudyCardRow>(
      `${STUDY_CARD_SELECT} AND c.id = ? LIMIT 1`,
      cardId,
    );
    return row ? toStudyCard(row) : null;
  }

  async insertLanguagePair(value: LanguagePair): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO language_pairs (
        id, target_language_code, target_language_name, reference_language_code, reference_language_name,
        created_at, updated_at, version, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      value.id,
      value.targetLanguageCode,
      value.targetLanguageName,
      value.referenceLanguageCode,
      value.referenceLanguageName,
      value.createdAt,
      value.updatedAt,
      value.version,
      value.deletedAt,
    );
  }

  async insertTerm(value: Term): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO terms (id, language_pair_id, text, normalized_text, kind, created_at, updated_at, version, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      value.id,
      value.languagePairId,
      value.text,
      value.normalizedText,
      value.kind,
      value.createdAt,
      value.updatedAt,
      value.version,
      value.deletedAt,
    );
  }

  async insertSense(value: Sense): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO senses (
        id, term_id, translation, definition, part_of_speech, note, image_uri, audio_uri,
        created_at, updated_at, version, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      value.id,
      value.termId,
      value.translation,
      value.definition,
      value.partOfSpeech,
      value.note,
      value.imageUri,
      value.audioUri,
      value.createdAt,
      value.updatedAt,
      value.version,
      value.deletedAt,
    );
  }

  async insertCard(value: Card): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO cards (id, sense_id, prompt_mode, created_at, updated_at, version, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      value.id,
      value.senseId,
      value.promptMode,
      value.createdAt,
      value.updatedAt,
      value.version,
      value.deletedAt,
    );
  }

  async insertCollection(value: Collection): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO collections (id, name, description, created_at, updated_at, version, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      value.id,
      value.name,
      value.description,
      value.createdAt,
      value.updatedAt,
      value.version,
      value.deletedAt,
    );
  }

  async addCardToCollection(collectionId: string, cardId: string, createdAt: string): Promise<void> {
    await this.db.runAsync(
      `INSERT OR IGNORE INTO collection_items (collection_id, card_id, created_at) VALUES (?, ?, ?)`,
      collectionId,
      cardId,
      createdAt,
    );
  }

  async insertSource(value: Source): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO sources (id, type, title, external_id, uri, created_at, updated_at, version, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      value.id,
      value.type,
      value.title,
      value.externalId,
      value.uri,
      value.createdAt,
      value.updatedAt,
      value.version,
      value.deletedAt,
    );
  }

  async insertSourceOccurrence(value: SourceOccurrence): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO source_occurrences (
        id, source_id, sense_id, original_sentence, page_number, timestamp_seconds, locator,
        created_at, updated_at, version, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      value.id,
      value.sourceId,
      value.senseId,
      value.originalSentence,
      value.pageNumber,
      value.timestampSeconds,
      value.locator,
      value.createdAt,
      value.updatedAt,
      value.version,
      value.deletedAt,
    );
  }
}

export class UserCardStateRepository {
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
    }>(`SELECT * FROM user_card_states WHERE card_id = ?`, cardId);

    return row
      ? {
          cardId: row.card_id,
          lifecycle: row.lifecycle,
          repetitions: row.repetitions,
          lapses: row.lapses,
          lastReviewedAt: row.last_reviewed_at,
          nextDueAt: row.next_due_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          version: row.version,
        }
      : null;
  }

  async upsert(value: UserCardState): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO user_card_states (
        card_id, lifecycle, repetitions, lapses, last_reviewed_at, next_due_at, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(card_id) DO UPDATE SET
        lifecycle = excluded.lifecycle,
        repetitions = excluded.repetitions,
        lapses = excluded.lapses,
        last_reviewed_at = excluded.last_reviewed_at,
        next_due_at = excluded.next_due_at,
        updated_at = excluded.updated_at,
        version = excluded.version`,
      value.cardId,
      value.lifecycle,
      value.repetitions,
      value.lapses,
      value.lastReviewedAt,
      value.nextDueAt,
      value.createdAt,
      value.updatedAt,
      value.version,
    );
  }
}

export class ReviewEventRepository {
  constructor(private readonly db: SqlDatabase) {}

  async getById(id: string): Promise<ReviewEvent | null> {
    const row = await this.db.getFirstAsync<{
      id: string;
      card_id: string;
      session_id: string;
      grade: ReviewEvent['grade'];
      reviewed_at: string;
      response_ms: number | null;
    }>(`SELECT * FROM review_events WHERE id = ?`, id);
    return row
      ? {
          id: row.id,
          cardId: row.card_id,
          sessionId: row.session_id,
          grade: row.grade,
          reviewedAt: row.reviewed_at,
          responseMs: row.response_ms,
        }
      : null;
  }

  async append(value: ReviewEvent): Promise<boolean> {
    const result = await this.db.runAsync(
      `INSERT OR IGNORE INTO review_events (id, card_id, session_id, grade, reviewed_at, response_ms)
       VALUES (?, ?, ?, ?, ?, ?)`,
      value.id,
      value.cardId,
      value.sessionId,
      value.grade,
      value.reviewedAt,
      value.responseMs,
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
    }>(
      `SELECT * FROM review_events WHERE card_id = ? ORDER BY reviewed_at ASC, id ASC`,
      cardId,
    );
    return rows.map((row) => ({
      id: row.id,
      cardId: row.card_id,
      sessionId: row.session_id,
      grade: row.grade,
      reviewedAt: row.reviewed_at,
      responseMs: row.response_ms,
    }));
  }
}
