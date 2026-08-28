import type { SQLiteDatabase } from 'expo-sqlite';
import type { ReviewGrade, SourceType, StudyLifecycle, TermKind } from '@/domain/types';
import { createId } from '@/utils/id';
import { asSqlDatabase, type SqlDatabase } from './database';

export type BankFilter = 'ALL' | 'LEARNING' | 'STRONG';

export interface BankItem {
  cardId: string;
  termId: string;
  senseId: string;
  languagePairId: string;
  term: string;
  termKind: TermKind;
  translation: string;
  definition: string | null;
  partOfSpeech: string | null;
  pronunciationText: string | null;
  note: string | null;
  contextSentence: string | null;
  sourceTitle: string | null;
  sourceType: SourceType | null;
  lifecycle: StudyLifecycle | 'NEW';
  nextDueAt: string | null;
  reviewCount: number;
}

export interface DetailContext {
  id: string;
  sentence: string | null;
  sourceTitle: string | null;
  sourceType: SourceType | null;
  sourceUri: string | null;
  pageNumber: number | null;
  timestampSeconds: number | null;
}

export interface ReviewHistoryItem {
  id: string;
  grade: ReviewGrade;
  reviewedAt: string;
  responseMs: number | null;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  cardCount: number;
}

export interface VocabularyDetail extends BankItem {
  exampleTranslation: string | null;
  contexts: DetailContext[];
  collections: CollectionSummary[];
  reviews: ReviewHistoryItem[];
}

const BANK_SELECT = `
SELECT
  c.id AS card_id,
  t.id AS term_id,
  s.id AS sense_id,
  t.language_pair_id,
  t.text AS term,
  t.kind AS term_kind,
  s.translation,
  s.definition,
  s.part_of_speech,
  s.pronunciation_text,
  s.note,
  (
    SELECT so.original_sentence FROM source_occurrences so
    WHERE so.sense_id = s.id AND so.deleted_at IS NULL
    ORDER BY so.created_at ASC, so.id ASC LIMIT 1
  ) AS context_sentence,
  (
    SELECT src.title FROM source_occurrences so JOIN sources src ON src.id = so.source_id
    WHERE so.sense_id = s.id AND so.deleted_at IS NULL AND src.deleted_at IS NULL
    ORDER BY so.created_at ASC, so.id ASC LIMIT 1
  ) AS source_title,
  (
    SELECT src.type FROM source_occurrences so JOIN sources src ON src.id = so.source_id
    WHERE so.sense_id = s.id AND so.deleted_at IS NULL AND src.deleted_at IS NULL
    ORDER BY so.created_at ASC, so.id ASC LIMIT 1
  ) AS source_type,
  COALESCE(ucs.lifecycle, 'NEW') AS lifecycle,
  ucs.next_due_at,
  (SELECT COUNT(*) FROM review_events re WHERE re.card_id = c.id) AS review_count
FROM cards c
JOIN senses s ON s.id = c.sense_id AND s.deleted_at IS NULL
JOIN terms t ON t.id = s.term_id AND t.deleted_at IS NULL
LEFT JOIN user_card_states ucs ON ucs.card_id = c.id
WHERE c.deleted_at IS NULL AND t.language_pair_id = ?
`;

type BankRow = {
  card_id: string;
  term_id: string;
  sense_id: string;
  language_pair_id: string;
  term: string;
  term_kind: TermKind;
  translation: string;
  definition: string | null;
  part_of_speech: string | null;
  pronunciation_text: string | null;
  note: string | null;
  context_sentence: string | null;
  source_title: string | null;
  source_type: SourceType | null;
  lifecycle: StudyLifecycle | 'NEW';
  next_due_at: string | null;
  review_count: number;
};

function mapBank(row: BankRow): BankItem {
  return {
    cardId: row.card_id,
    termId: row.term_id,
    senseId: row.sense_id,
    languagePairId: row.language_pair_id,
    term: row.term,
    termKind: row.term_kind,
    translation: row.translation,
    definition: row.definition,
    partOfSpeech: row.part_of_speech,
    pronunciationText: row.pronunciation_text,
    note: row.note,
    contextSentence: row.context_sentence,
    sourceTitle: row.source_title,
    sourceType: row.source_type,
    lifecycle: row.lifecycle,
    nextDueAt: row.next_due_at,
    reviewCount: row.review_count,
  };
}

export class CatalogRepository {
  constructor(private readonly db: SqlDatabase) {}

  async listBank(languagePairId: string, search = '', filter: BankFilter = 'ALL', now = new Date()): Promise<BankItem[]> {
    const needle = `%${search.trim().toLocaleLowerCase()}%`;
    const rows = await this.db.getAllAsync<BankRow>(
      `${BANK_SELECT}
       AND (? = '%%' OR LOWER(t.text) LIKE ? OR LOWER(s.translation) LIKE ? OR EXISTS (
         SELECT 1 FROM source_occurrences sx WHERE sx.sense_id = s.id AND LOWER(COALESCE(sx.original_sentence, '')) LIKE ?
       ))
       AND (
         ? = 'ALL'
         OR (? = 'LEARNING' AND (ucs.lifecycle IS NULL OR ucs.lifecycle IN ('NEW','LEARNING') OR ucs.next_due_at <= ?))
         OR (? = 'STRONG' AND ucs.lifecycle IN ('REVIEW','MASTERED') AND (ucs.next_due_at IS NULL OR ucs.next_due_at > ?))
       )
       ORDER BY LOWER(t.text) ASC, s.created_at ASC, c.id ASC`,
      languagePairId,
      needle,
      needle,
      needle,
      needle,
      filter,
      filter,
      now.toISOString(),
      filter,
      now.toISOString(),
    );
    return rows.map(mapBank);
  }

  async getDetail(cardId: string): Promise<VocabularyDetail | null> {
    const row = await this.db.getFirstAsync<BankRow & { example_translation: string | null }>(
      `${BANK_SELECT.replace('WHERE c.deleted_at IS NULL AND t.language_pair_id = ?', 'WHERE c.deleted_at IS NULL AND c.id = ?')} LIMIT 1`,
      cardId,
    );
    if (!row) return null;
    const [contexts, collections, reviews] = await Promise.all([
      this.db.getAllAsync<{
        id: string; sentence: string | null; source_title: string | null; source_type: SourceType | null;
        source_uri: string | null; page_number: number | null; timestamp_seconds: number | null;
      }>(
        `SELECT so.id, so.original_sentence AS sentence, src.title AS source_title, src.type AS source_type,
                src.uri AS source_uri, so.page_number, so.timestamp_seconds
         FROM source_occurrences so JOIN sources src ON src.id = so.source_id
         WHERE so.sense_id = ? AND so.deleted_at IS NULL AND src.deleted_at IS NULL
         ORDER BY so.created_at ASC, so.id ASC`,
        row.sense_id,
      ),
      this.db.getAllAsync<{ id: string; name: string; description: string | null; card_count: number }>(
        `SELECT col.id, col.name, col.description,
                (SELECT COUNT(*) FROM collection_items ci2 WHERE ci2.collection_id = col.id) AS card_count
         FROM collections col JOIN collection_items ci ON ci.collection_id = col.id
         WHERE ci.card_id = ? AND col.deleted_at IS NULL ORDER BY LOWER(col.name)`,
        cardId,
      ),
      this.db.getAllAsync<{ id: string; grade: ReviewGrade; reviewed_at: string; response_ms: number | null }>(
        `SELECT id, grade, reviewed_at, response_ms FROM review_events WHERE card_id = ? ORDER BY reviewed_at DESC, id DESC`,
        cardId,
      ),
    ]);
    return {
      ...mapBank(row),
      exampleTranslation: row.example_translation,
      contexts: contexts.map((item) => ({
        id: item.id,
        sentence: item.sentence,
        sourceTitle: item.source_type === 'MANUAL' ? null : item.source_title,
        sourceType: item.source_type,
        sourceUri: item.source_uri,
        pageNumber: item.page_number,
        timestampSeconds: item.timestamp_seconds,
      })),
      collections: collections.map((item) => ({ id: item.id, name: item.name, description: item.description, cardCount: item.card_count })),
      reviews: reviews.map((item) => ({ id: item.id, grade: item.grade, reviewedAt: item.reviewed_at, responseMs: item.response_ms })),
    };
  }

  async listCollections(languagePairId: string): Promise<CollectionSummary[]> {
    const rows = await this.db.getAllAsync<{ id: string; name: string; description: string | null; card_count: number }>(
      `SELECT col.id, col.name, col.description,
              (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = col.id) AS card_count
       FROM collections col WHERE col.language_pair_id = ? AND col.deleted_at IS NULL
       ORDER BY LOWER(col.name), col.id`,
      languagePairId,
    );
    return rows.map((row) => ({ id: row.id, name: row.name, description: row.description, cardCount: row.card_count }));
  }

  async createCollection(languagePairId: string, name: string, description: string | null = null, now = new Date()): Promise<string> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Collection name is required.');
    const id = createId('collection');
    const timestamp = now.toISOString();
    await this.db.runAsync(
      `INSERT INTO collections(id, name, description, created_at, updated_at, version, deleted_at, language_pair_id)
       VALUES (?, ?, ?, ?, ?, 1, NULL, ?)`,
      id, trimmed, description?.trim() || null, timestamp, timestamp, languagePairId,
    );
    return id;
  }

  async renameCollection(id: string, name: string, now = new Date()): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Collection name is required.');
    await this.db.runAsync(
      `UPDATE collections SET name = ?, updated_at = ?, version = version + 1 WHERE id = ? AND deleted_at IS NULL`,
      trimmed, now.toISOString(), id,
    );
  }

  async archiveCollection(id: string, now = new Date()): Promise<void> {
    await this.db.runAsync(
      `UPDATE collections SET deleted_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND deleted_at IS NULL`,
      now.toISOString(), now.toISOString(), id,
    );
  }

  async addToCollection(cardId: string, collectionId: string, now = new Date()): Promise<void> {
    await this.db.runAsync(
      `INSERT OR IGNORE INTO collection_items(collection_id, card_id, created_at) VALUES (?, ?, ?)`,
      collectionId, cardId, now.toISOString(),
    );
  }

  async removeFromCollection(cardId: string, collectionId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM collection_items WHERE collection_id = ? AND card_id = ?', collectionId, cardId);
  }
}

export interface ManualVocabularyInput {
  languagePairId: string;
  term: string;
  kind: TermKind;
  translation: string;
  definition?: string;
  partOfSpeech?: string;
  pronunciationText?: string;
  exampleTranslation?: string;
  note?: string;
  contextSentence?: string;
  collectionIds?: string[];
}

export interface ManualVocabularyResult {
  cardId: string;
  termId: string;
  senseId: string;
  reusedTerm: boolean;
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export class ManualVocabularyService {
  constructor(private readonly db: SQLiteDatabase) {}

  async create(input: ManualVocabularyInput, now = new Date()): Promise<ManualVocabularyResult> {
    const termText = input.term.trim().replace(/\s+/g, ' ');
    const translation = input.translation.trim();
    if (!termText) throw new Error('Term or phrase is required.');
    if (!translation) throw new Error('Meaning or translation is required.');
    const sql = asSqlDatabase(this.db);
    const normalized = normalize(termText);
    const duplicate = await sql.getFirstAsync<{ card_id: string }>(
      `SELECT c.id AS card_id FROM terms t JOIN senses s ON s.term_id = t.id JOIN cards c ON c.sense_id = s.id
       WHERE t.language_pair_id = ? AND t.normalized_text = ? AND LOWER(TRIM(s.translation)) = ?
         AND t.deleted_at IS NULL AND s.deleted_at IS NULL AND c.deleted_at IS NULL LIMIT 1`,
      input.languagePairId, normalized, translation.toLocaleLowerCase(),
    );
    if (duplicate) throw new Error('That term and meaning already exist in this language pair.');

    const existingTerm = await sql.getFirstAsync<{ id: string }>(
      `SELECT id FROM terms WHERE language_pair_id = ? AND normalized_text = ? AND deleted_at IS NULL ORDER BY created_at LIMIT 1`,
      input.languagePairId, normalized,
    );
    const timestamp = now.toISOString();
    const termId = existingTerm?.id ?? createId('term');
    const senseId = createId('sense');
    const cardId = createId('card');
    const sourceId = createId('source');
    const occurrenceId = createId('occurrence');

    await this.db.withExclusiveTransactionAsync(async (txn) => {
      if (!existingTerm) {
        await txn.runAsync(
          `INSERT INTO terms(id, language_pair_id, text, normalized_text, kind, created_at, updated_at, version, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL)`,
          termId, input.languagePairId, termText, normalized, input.kind, timestamp, timestamp,
        );
      }
      await txn.runAsync(
        `INSERT INTO senses(id, term_id, translation, definition, part_of_speech, note, image_uri, audio_uri,
          created_at, updated_at, version, deleted_at, pronunciation_text, example_translation)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 1, NULL, ?, ?)`,
        senseId, termId, translation, input.definition?.trim() || null, input.partOfSpeech?.trim() || null,
        input.note?.trim() || null, timestamp, timestamp, input.pronunciationText?.trim() || null,
        input.exampleTranslation?.trim() || null,
      );
      await txn.runAsync(
        `INSERT INTO cards(id, sense_id, prompt_mode, created_at, updated_at, version, deleted_at)
         VALUES (?, ?, 'TARGET_TO_MEANING', ?, ?, 1, NULL)`,
        cardId, senseId, timestamp, timestamp,
      );
      if (input.contextSentence?.trim()) {
        await txn.runAsync(
          `INSERT INTO sources(id, type, title, external_id, uri, created_at, updated_at, version, deleted_at)
           VALUES (?, 'MANUAL', NULL, NULL, NULL, ?, ?, 1, NULL)`,
          sourceId, timestamp, timestamp,
        );
        await txn.runAsync(
          `INSERT INTO source_occurrences(id, source_id, sense_id, original_sentence, page_number, timestamp_seconds, locator,
            created_at, updated_at, version, deleted_at)
           VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 1, NULL)`,
          occurrenceId, sourceId, senseId, input.contextSentence.trim(), timestamp, timestamp,
        );
      }
      for (const collectionId of input.collectionIds ?? []) {
        await txn.runAsync(
          `INSERT OR IGNORE INTO collection_items(collection_id, card_id, created_at) VALUES (?, ?, ?)`,
          collectionId, cardId, timestamp,
        );
      }
    });
    return { cardId, termId, senseId, reusedTerm: Boolean(existingTerm) };
  }

  async edit(cardId: string, input: Pick<ManualVocabularyInput, 'term' | 'translation' | 'definition' | 'partOfSpeech' | 'pronunciationText' | 'exampleTranslation' | 'note' | 'contextSentence'>, now = new Date()): Promise<void> {
    const sql = asSqlDatabase(this.db);
    const current = await sql.getFirstAsync<{ term_id: string; sense_id: string; old_term: string; old_translation: string }>(
      `SELECT t.id AS term_id, s.id AS sense_id, t.text AS old_term, s.translation AS old_translation
       FROM cards c JOIN senses s ON s.id = c.sense_id JOIN terms t ON t.id = s.term_id WHERE c.id = ?`,
      cardId,
    );
    if (!current) throw new Error('Vocabulary item not found.');
    const term = input.term.trim().replace(/\s+/g, ' ');
    const translation = input.translation.trim();
    if (!term || !translation) throw new Error('Term and meaning are required.');
    const materialMeaningChange = normalize(current.old_term) !== normalize(term)
      || normalize(current.old_translation) !== normalize(translation);
    const timestamp = now.toISOString();

    await this.db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `UPDATE terms SET text = ?, normalized_text = ?, updated_at = ?, version = version + 1 WHERE id = ?`,
        term, normalize(term), timestamp, current.term_id,
      );
      await txn.runAsync(
        `UPDATE senses SET translation = ?, definition = ?, part_of_speech = ?, pronunciation_text = ?,
          example_translation = ?, note = ?, updated_at = ?, version = version + 1 WHERE id = ?`,
        translation, input.definition?.trim() || null, input.partOfSpeech?.trim() || null,
        input.pronunciationText?.trim() || null, input.exampleTranslation?.trim() || null,
        input.note?.trim() || null, timestamp, current.sense_id,
      );
      const occurrence = await txn.getFirstAsync<{ id: string }>(
        `SELECT id FROM source_occurrences WHERE sense_id = ? AND deleted_at IS NULL ORDER BY created_at LIMIT 1`,
        current.sense_id,
      );
      if (occurrence) {
        await txn.runAsync(
          `UPDATE source_occurrences SET original_sentence = ?, updated_at = ?, version = version + 1 WHERE id = ?`,
          input.contextSentence?.trim() || null, timestamp, occurrence.id,
        );
      }
      if (materialMeaningChange) {
        await txn.runAsync(
          `UPDATE user_card_states SET lifecycle = 'LEARNING', repetitions = 0, next_due_at = ?, updated_at = ?, version = version + 1
           WHERE card_id = ?`,
          timestamp, timestamp, cardId,
        );
      }
    });
  }
}
