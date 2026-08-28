import type { SourceType, StudyCard, StudyLifecycle } from '@/domain/types';
import type { SqlDatabase } from '@/data/database';
import type { StudyDataSource } from './session';

type Row = {
  card_id: string; term_id: string; sense_id: string; target_language_code: string; reference_language_code: string;
  term: string; term_kind: 'WORD' | 'PHRASE'; translation: string; definition: string | null; part_of_speech: string | null;
  note: string | null; image_uri: string | null; audio_uri: string | null; context_sentence: string | null;
  source_title: string | null; source_type: SourceType | null; source_page_number: number | null; source_timestamp_seconds: number | null;
  created_at: string; lifecycle: StudyLifecycle | null; repetitions: number | null; lapses: number | null;
  last_reviewed_at: string | null; next_due_at: string | null; state_created_at: string | null; state_updated_at: string | null;
  state_version: number | null;
};

export class ScopedStudyDataSource implements StudyDataSource {
  constructor(private readonly db: SqlDatabase, private readonly languagePairId: string) {}

  async listStudyCandidates(): Promise<StudyCard[]> {
    const rows = await this.db.getAllAsync<Row>(`
      SELECT c.id AS card_id, t.id AS term_id, s.id AS sense_id,
        lp.target_language_code, lp.reference_language_code, t.text AS term, t.kind AS term_kind,
        s.translation, s.definition, s.part_of_speech, s.note, s.image_uri, s.audio_uri,
        so.original_sentence AS context_sentence, src.title AS source_title, src.type AS source_type,
        so.page_number AS source_page_number, so.timestamp_seconds AS source_timestamp_seconds,
        c.created_at, ucs.lifecycle, ucs.repetitions, ucs.lapses, ucs.last_reviewed_at, ucs.next_due_at,
        ucs.created_at AS state_created_at, ucs.updated_at AS state_updated_at, ucs.version AS state_version
      FROM cards c
      JOIN senses s ON s.id = c.sense_id AND s.deleted_at IS NULL
      JOIN terms t ON t.id = s.term_id AND t.deleted_at IS NULL
      JOIN language_pairs lp ON lp.id = t.language_pair_id AND lp.deleted_at IS NULL
      LEFT JOIN user_card_states ucs ON ucs.card_id = c.id
      LEFT JOIN source_occurrences so ON so.id = (
        SELECT so2.id FROM source_occurrences so2 WHERE so2.sense_id = s.id AND so2.deleted_at IS NULL
        ORDER BY so2.created_at ASC, so2.id ASC LIMIT 1
      )
      LEFT JOIN sources src ON src.id = so.source_id AND src.deleted_at IS NULL
      WHERE c.deleted_at IS NULL AND t.language_pair_id = ?
      ORDER BY c.created_at ASC, c.id ASC
    `, this.languagePairId);

    return rows.map((row) => ({
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
      sourceTitle: row.source_type === 'MANUAL' ? null : row.source_title,
      sourceType: row.source_type,
      sourcePageNumber: row.source_page_number,
      sourceTimestampSeconds: row.source_timestamp_seconds,
      createdAt: row.created_at,
      state: row.lifecycle ? {
        cardId: row.card_id,
        lifecycle: row.lifecycle,
        repetitions: row.repetitions ?? 0,
        lapses: row.lapses ?? 0,
        lastReviewedAt: row.last_reviewed_at,
        nextDueAt: row.next_due_at,
        createdAt: row.state_created_at ?? row.created_at,
        updatedAt: row.state_updated_at ?? row.created_at,
        version: row.state_version ?? 1,
      } : null,
    }));
  }
}
