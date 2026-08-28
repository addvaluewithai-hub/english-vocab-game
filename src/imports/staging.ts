import type { SQLiteDatabase } from 'expo-sqlite';
import type { SourceType } from '@/domain/types';
import { ManualVocabularyService } from '@/data/catalog';
import { asSqlDatabase } from '@/data/database';
import { createId } from '@/utils/id';

export type DuplicateKind = 'NONE' | 'EXACT' | 'TERM_ONLY';

export interface ProposedVocabulary {
  term: string;
  translation: string;
  definition?: string;
  contextSentence?: string;
  partOfSpeech?: string;
  usefulnessScore?: number;
  confidenceScore?: number;
  sourceUri?: string;
  sourceLocator?: string;
  sourcePageNumber?: number;
  sourceTimestampSeconds?: number;
  isVisuallyConcrete?: boolean;
}

export interface StagedCandidate extends ProposedVocabulary {
  id: string;
  batchId: string;
  duplicateKind: DuplicateKind;
  selected: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface ImportBatch {
  id: string;
  languagePairId: string;
  sourceType: SourceType;
  sourceTitle: string | null;
  createdAt: string;
}

function optionalString(key: 'definition' | 'contextSentence' | 'partOfSpeech' | 'sourceUri' | 'sourceLocator', value: string | null) {
  return value === null ? {} : { [key]: value };
}

function optionalNumber(key: 'usefulnessScore' | 'confidenceScore' | 'sourcePageNumber' | 'sourceTimestampSeconds', value: number | null) {
  return value === null ? {} : { [key]: value };
}

function normalizedTerm(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export class ImportStagingService {
  constructor(private readonly db: SQLiteDatabase) {}

  async createBatch(
    languagePairId: string,
    sourceType: SourceType,
    sourceTitle: string | null,
    candidates: ProposedVocabulary[],
    now = new Date(),
  ): Promise<string> {
    const batchId = createId('import');
    const createdAt = now.toISOString();

    await this.db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO import_batches(id, language_pair_id, source_type, source_title, created_at) VALUES (?, ?, ?, ?, ?)`,
        batchId,
        languagePairId,
        sourceType,
        sourceTitle,
        createdAt,
      );

      for (const candidate of candidates) {
        const term = candidate.term.trim().replace(/\s+/g, ' ');
        const translation = candidate.translation.trim();
        if (!term || !translation) continue;

        const normalized = term.toLocaleLowerCase();
        const exact = await txn.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) AS count FROM terms t JOIN senses s ON s.term_id = t.id
           WHERE t.language_pair_id = ? AND t.normalized_text = ? AND LOWER(TRIM(s.translation)) = ?
             AND t.deleted_at IS NULL AND s.deleted_at IS NULL`,
          languagePairId,
          normalized,
          translation.toLocaleLowerCase(),
        );
        const sameTerm = exact?.count
          ? 0
          : ((await txn.getFirstAsync<{ count: number }>(
              `SELECT COUNT(*) AS count FROM terms WHERE language_pair_id = ? AND normalized_text = ? AND deleted_at IS NULL`,
              languagePairId,
              normalized,
            ))?.count ?? 0);
        const duplicateKind: DuplicateKind = exact?.count
          ? 'EXACT'
          : sameTerm
            ? 'TERM_ONLY'
            : 'NONE';

        await txn.runAsync(
          `INSERT INTO import_candidates(
             id, batch_id, term, translation, definition, context_sentence, part_of_speech,
             usefulness_score, confidence_score, duplicate_kind, selected, status, created_at,
             source_uri, source_locator, source_page_number, source_timestamp_seconds, is_visually_concrete
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)`,
          createId('candidate'),
          batchId,
          term,
          translation,
          candidate.definition?.trim() || null,
          candidate.contextSentence?.trim() || null,
          candidate.partOfSpeech?.trim() || null,
          candidate.usefulnessScore ?? null,
          candidate.confidenceScore ?? null,
          duplicateKind,
          duplicateKind === 'EXACT' ? 0 : 1,
          createdAt,
          candidate.sourceUri?.trim() || null,
          candidate.sourceLocator?.trim() || null,
          candidate.sourcePageNumber ?? null,
          candidate.sourceTimestampSeconds ?? null,
          candidate.isVisuallyConcrete === undefined ? null : candidate.isVisuallyConcrete ? 1 : 0,
        );
      }
    });

    return batchId;
  }

  async latestPendingBatch(languagePairId: string): Promise<ImportBatch | null> {
    const row = await asSqlDatabase(this.db).getFirstAsync<{
      id: string;
      language_pair_id: string;
      source_type: SourceType;
      source_title: string | null;
      created_at: string;
    }>(
      `SELECT b.* FROM import_batches b WHERE b.language_pair_id = ? AND EXISTS (
        SELECT 1 FROM import_candidates c WHERE c.batch_id = b.id AND c.status = 'PENDING'
      ) ORDER BY b.created_at DESC LIMIT 1`,
      languagePairId,
    );

    return row
      ? {
          id: row.id,
          languagePairId: row.language_pair_id,
          sourceType: row.source_type,
          sourceTitle: row.source_title,
          createdAt: row.created_at,
        }
      : null;
  }

  async listCandidates(batchId: string): Promise<StagedCandidate[]> {
    const rows = await asSqlDatabase(this.db).getAllAsync<{
      id: string;
      batch_id: string;
      term: string;
      translation: string;
      definition: string | null;
      context_sentence: string | null;
      part_of_speech: string | null;
      usefulness_score: number | null;
      confidence_score: number | null;
      duplicate_kind: DuplicateKind;
      selected: number;
      status: StagedCandidate['status'];
      source_uri: string | null;
      source_locator: string | null;
      source_page_number: number | null;
      source_timestamp_seconds: number | null;
      is_visually_concrete: number | null;
    }>(
      `SELECT * FROM import_candidates WHERE batch_id = ? ORDER BY created_at, id`,
      batchId,
    );

    return rows.map((row) => ({
      id: row.id,
      batchId: row.batch_id,
      term: row.term,
      translation: row.translation,
      ...optionalString('definition', row.definition),
      ...optionalString('contextSentence', row.context_sentence),
      ...optionalString('partOfSpeech', row.part_of_speech),
      ...optionalNumber('usefulnessScore', row.usefulness_score),
      ...optionalNumber('confidenceScore', row.confidence_score),
      ...optionalString('sourceUri', row.source_uri),
      ...optionalString('sourceLocator', row.source_locator),
      ...optionalNumber('sourcePageNumber', row.source_page_number),
      ...optionalNumber('sourceTimestampSeconds', row.source_timestamp_seconds),
      ...(row.is_visually_concrete === null ? {} : { isVisuallyConcrete: row.is_visually_concrete === 1 }),
      duplicateKind: row.duplicate_kind,
      selected: row.selected === 1,
      status: row.status,
    }));
  }

  async setSelected(candidateId: string, selected: boolean): Promise<void> {
    await this.db.runAsync(
      `UPDATE import_candidates SET selected = ? WHERE id = ? AND status = 'PENDING'`,
      selected ? 1 : 0,
      candidateId,
    );
  }

  async updateCandidate(
    candidateId: string,
    patch: Pick<ProposedVocabulary, 'term' | 'translation' | 'definition' | 'contextSentence'>,
  ): Promise<void> {
    await this.db.runAsync(
      `UPDATE import_candidates SET term = ?, translation = ?, definition = ?, context_sentence = ? WHERE id = ? AND status = 'PENDING'`,
      patch.term.trim(),
      patch.translation.trim(),
      patch.definition?.trim() || null,
      patch.contextSentence?.trim() || null,
      candidateId,
    );
  }

  async rejectUnselected(batchId: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE import_candidates SET status = 'REJECTED' WHERE batch_id = ? AND status = 'PENDING' AND selected = 0`,
      batchId,
    );
  }

  private async findCanonicalSense(batch: ImportBatch, item: StagedCandidate): Promise<string | null> {
    const row = await asSqlDatabase(this.db).getFirstAsync<{ sense_id: string }>(
      `SELECT s.id AS sense_id
       FROM terms t
       JOIN senses s ON s.term_id = t.id
       JOIN cards c ON c.sense_id = s.id
       WHERE t.language_pair_id = ?
         AND t.normalized_text = ?
         AND LOWER(TRIM(s.translation)) = ?
         AND t.deleted_at IS NULL
         AND s.deleted_at IS NULL
         AND c.deleted_at IS NULL
       ORDER BY s.created_at ASC, s.id ASC
       LIMIT 1`,
      batch.languagePairId,
      normalizedTerm(item.term),
      item.translation.trim().toLocaleLowerCase(),
    );
    return row?.sense_id ?? null;
  }

  private async attachImportProvenance(batch: ImportBatch, item: StagedCandidate, senseId: string): Promise<void> {
    const sourceId = `import-source-${batch.id}`;
    const occurrenceId = `import-occurrence-${item.id}`;
    const timestamp = new Date().toISOString();

    await this.db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT OR IGNORE INTO sources(id, type, title, external_id, uri, created_at, updated_at, version, deleted_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, 1, NULL)`,
        sourceId,
        batch.sourceType,
        batch.sourceTitle,
        item.sourceUri?.trim() || null,
        batch.createdAt,
        batch.createdAt,
      );
      await txn.runAsync(
        `INSERT OR IGNORE INTO source_occurrences(
           id, source_id, sense_id, original_sentence, page_number, timestamp_seconds, locator,
           created_at, updated_at, version, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)`,
        occurrenceId,
        sourceId,
        senseId,
        item.contextSentence?.trim() || null,
        item.sourcePageNumber ?? null,
        item.sourceTimestampSeconds ?? null,
        item.sourceLocator?.trim() || null,
        timestamp,
        timestamp,
      );
    });
  }

  async approveSelected(batch: ImportBatch): Promise<number> {
    const candidates = (await this.listCandidates(batch.id)).filter(
      (item) => item.selected && item.status === 'PENDING' && item.duplicateKind !== 'EXACT',
    );
    const creator = new ManualVocabularyService(this.db);
    let approved = 0;

    for (const item of candidates) {
      try {
        const created = await creator.create({
          languagePairId: batch.languagePairId,
          term: item.term,
          kind: item.term.includes(' ') ? 'PHRASE' : 'WORD',
          translation: item.translation,
          ...(item.definition === undefined ? {} : { definition: item.definition }),
          ...(item.partOfSpeech === undefined ? {} : { partOfSpeech: item.partOfSpeech }),
        });
        await this.attachImportProvenance(batch, item, created.senseId);
        await this.db.runAsync(
          `UPDATE import_candidates SET status = 'APPROVED' WHERE id = ?`,
          item.id,
        );
        approved += 1;
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exist')) {
          const existingSenseId = await this.findCanonicalSense(batch, item);
          if (!existingSenseId) throw error;
          await this.attachImportProvenance(batch, item, existingSenseId);
          await this.db.runAsync(
            `UPDATE import_candidates SET status = 'APPROVED', duplicate_kind = 'EXACT' WHERE id = ?`,
            item.id,
          );
          approved += 1;
        } else {
          throw error;
        }
      }
    }

    await this.rejectUnselected(batch.id);
    return approved;
  }
}
