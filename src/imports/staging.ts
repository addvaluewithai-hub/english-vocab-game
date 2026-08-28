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

export class ImportStagingService {
  constructor(private readonly db: SQLiteDatabase) {}

  async createBatch(languagePairId: string, sourceType: SourceType, sourceTitle: string | null, candidates: ProposedVocabulary[], now = new Date()): Promise<string> {
    const batchId = createId('import');
    const createdAt = now.toISOString();
    const sql = asSqlDatabase(this.db);
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO import_batches(id, language_pair_id, source_type, source_title, created_at) VALUES (?, ?, ?, ?, ?)`,
        batchId, languagePairId, sourceType, sourceTitle, createdAt,
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
          languagePairId, normalized, translation.toLocaleLowerCase(),
        );
        const sameTerm = exact?.count ? 0 : (await txn.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) AS count FROM terms WHERE language_pair_id = ? AND normalized_text = ? AND deleted_at IS NULL`,
          languagePairId, normalized,
        ))?.count ?? 0;
        const duplicateKind: DuplicateKind = exact?.count ? 'EXACT' : sameTerm ? 'TERM_ONLY' : 'NONE';
        await txn.runAsync(
          `INSERT INTO import_candidates(id, batch_id, term, translation, definition, context_sentence, part_of_speech,
             usefulness_score, confidence_score, duplicate_kind, selected, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
          createId('candidate'), batchId, term, translation, candidate.definition?.trim() || null,
          candidate.contextSentence?.trim() || null, candidate.partOfSpeech?.trim() || null,
          candidate.usefulnessScore ?? null, candidate.confidenceScore ?? null, duplicateKind,
          duplicateKind === 'EXACT' ? 0 : 1, createdAt,
        );
      }
    });
    void sql;
    return batchId;
  }

  async latestPendingBatch(languagePairId: string): Promise<ImportBatch | null> {
    const row = await asSqlDatabase(this.db).getFirstAsync<{ id: string; language_pair_id: string; source_type: SourceType; source_title: string | null; created_at: string }>(
      `SELECT b.* FROM import_batches b WHERE b.language_pair_id = ? AND EXISTS (
        SELECT 1 FROM import_candidates c WHERE c.batch_id = b.id AND c.status = 'PENDING'
      ) ORDER BY b.created_at DESC LIMIT 1`, languagePairId,
    );
    return row ? { id: row.id, languagePairId: row.language_pair_id, sourceType: row.source_type, sourceTitle: row.source_title, createdAt: row.created_at } : null;
  }

  async listCandidates(batchId: string): Promise<StagedCandidate[]> {
    const rows = await asSqlDatabase(this.db).getAllAsync<{
      id: string; batch_id: string; term: string; translation: string; definition: string | null; context_sentence: string | null;
      part_of_speech: string | null; usefulness_score: number | null; confidence_score: number | null; duplicate_kind: DuplicateKind;
      selected: number; status: StagedCandidate['status'];
    }>(`SELECT * FROM import_candidates WHERE batch_id = ? ORDER BY created_at, id`, batchId);
    return rows.map((row) => ({
      id: row.id, batchId: row.batch_id, term: row.term, translation: row.translation,
      definition: row.definition ?? undefined, contextSentence: row.context_sentence ?? undefined,
      partOfSpeech: row.part_of_speech ?? undefined, usefulnessScore: row.usefulness_score ?? undefined,
      confidenceScore: row.confidence_score ?? undefined, duplicateKind: row.duplicate_kind,
      selected: row.selected === 1, status: row.status,
    }));
  }

  async setSelected(candidateId: string, selected: boolean): Promise<void> {
    await this.db.runAsync(`UPDATE import_candidates SET selected = ? WHERE id = ? AND status = 'PENDING'`, selected ? 1 : 0, candidateId);
  }

  async updateCandidate(candidateId: string, patch: Pick<ProposedVocabulary, 'term' | 'translation' | 'definition' | 'contextSentence'>): Promise<void> {
    await this.db.runAsync(
      `UPDATE import_candidates SET term = ?, translation = ?, definition = ?, context_sentence = ? WHERE id = ? AND status = 'PENDING'`,
      patch.term.trim(), patch.translation.trim(), patch.definition?.trim() || null, patch.contextSentence?.trim() || null, candidateId,
    );
  }

  async rejectUnselected(batchId: string): Promise<void> {
    await this.db.runAsync(`UPDATE import_candidates SET status = 'REJECTED' WHERE batch_id = ? AND status = 'PENDING' AND selected = 0`, batchId);
  }

  async approveSelected(batch: ImportBatch): Promise<number> {
    const candidates = (await this.listCandidates(batch.id)).filter((item) => item.selected && item.status === 'PENDING' && item.duplicateKind !== 'EXACT');
    const creator = new ManualVocabularyService(this.db);
    let approved = 0;
    for (const item of candidates) {
      try {
        await creator.create({
          languagePairId: batch.languagePairId,
          term: item.term,
          kind: item.term.includes(' ') ? 'PHRASE' : 'WORD',
          translation: item.translation,
          definition: item.definition,
          contextSentence: item.contextSentence,
          partOfSpeech: item.partOfSpeech,
        });
        await this.db.runAsync(`UPDATE import_candidates SET status = 'APPROVED' WHERE id = ?`, item.id);
        approved += 1;
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exist')) {
          await this.db.runAsync(`UPDATE import_candidates SET status = 'REJECTED', duplicate_kind = 'EXACT', selected = 0 WHERE id = ?`, item.id);
        } else throw error;
      }
    }
    await this.rejectUnselected(batch.id);
    return approved;
  }
}
