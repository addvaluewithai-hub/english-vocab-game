import type { SQLiteDatabase } from 'expo-sqlite';
import type { MahandGroup, MahandItem, MahandUnit } from '@/curriculum/mahand/types';
import type { TermKind } from '@/domain/types';
import { asSqlDatabase } from '@/data/database';
import { createId } from '@/utils/id';

export interface MahandImportResult {
  requested: number;
  added: number;
  reused: number;
  collectionsTouched: number;
}

type SqlDatabase = ReturnType<typeof asSqlDatabase>;

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function termKind(term: string): TermKind {
  return /\s|[-/]/.test(term.trim()) ? 'PHRASE' : 'WORD';
}

function unitCollectionName(unit: MahandUnit): string {
  return `مهند · وحدة ${String(unit.number).padStart(2, '0')} · ${unit.title}`;
}

function groupCollectionName(unit: MahandUnit, group: MahandGroup): string {
  return `مهند · وحدة ${String(unit.number).padStart(2, '0')} · جروب ${String(group.number).padStart(2, '0')} · ${group.title}`;
}

function collectionDescription(kind: 'course' | 'unit' | 'group', id: string): string {
  return `Mahand course collection · ${kind} · ${id}`;
}

async function ensureCollection(
  sql: SqlDatabase,
  languagePairId: string,
  name: string,
  description: string,
  timestamp: string,
): Promise<string> {
  const existing = await sql.getFirstAsync<{ id: string }>(
    `SELECT id FROM collections WHERE language_pair_id = ? AND name = ? AND deleted_at IS NULL LIMIT 1`,
    languagePairId,
    name,
  );
  if (existing) return existing.id;
  const id = createId('collection');
  await sql.runAsync(
    `INSERT INTO collections(id, name, description, created_at, updated_at, version, deleted_at, language_pair_id)
     VALUES (?, ?, ?, ?, ?, 1, NULL, ?)`,
    id,
    name,
    description,
    timestamp,
    timestamp,
    languagePairId,
  );
  return id;
}

export class MahandCourseImportService {
  constructor(private readonly db: SQLiteDatabase) {}

  async importGroup(languagePairId: string, unit: MahandUnit, group: MahandGroup): Promise<MahandImportResult> {
    return this.importItems(languagePairId, unit, [group], { includeUnit: false });
  }

  async importUnit(languagePairId: string, unit: MahandUnit): Promise<MahandImportResult> {
    return this.importItems(languagePairId, unit, unit.groups, { includeUnit: true });
  }

  async importCourse(languagePairId: string, units: readonly MahandUnit[]): Promise<MahandImportResult> {
    const timestamp = new Date().toISOString();
    const sql = asSqlDatabase(this.db);
    let total: MahandImportResult = { requested: 0, added: 0, reused: 0, collectionsTouched: 0 };
    const courseCollectionId = await ensureCollection(
      sql,
      languagePairId,
      'مهند · الكورس كله',
      collectionDescription('course', 'all'),
      timestamp,
    );
    total.collectionsTouched += 1;

    for (const unit of units) {
      const unitResult = await this.importItems(languagePairId, unit, unit.groups, {
        includeUnit: true,
        extraCollectionIds: [courseCollectionId],
        timestamp,
      });
      total = {
        requested: total.requested + unitResult.requested,
        added: total.added + unitResult.added,
        reused: total.reused + unitResult.reused,
        collectionsTouched: total.collectionsTouched + unitResult.collectionsTouched,
      };
    }
    return total;
  }

  private async importItems(
    languagePairId: string,
    unit: MahandUnit,
    groups: readonly MahandGroup[],
    options: {
      includeUnit?: boolean;
      extraCollectionIds?: string[];
      timestamp?: string;
    },
  ): Promise<MahandImportResult> {
    const sql = asSqlDatabase(this.db);
    const timestamp = options.timestamp ?? new Date().toISOString();
    const result: MahandImportResult = { requested: 0, added: 0, reused: 0, collectionsTouched: 0 };

    const unitCollectionId = options.includeUnit
      ? await ensureCollection(sql, languagePairId, unitCollectionName(unit), collectionDescription('unit', unit.id), timestamp)
      : null;
    if (unitCollectionId) result.collectionsTouched += 1;

    for (const group of groups) {
      const groupCollectionId = await ensureCollection(
        sql,
        languagePairId,
        groupCollectionName(unit, group),
        collectionDescription('group', group.id),
        timestamp,
      );
      result.collectionsTouched += 1;
      for (const item of group.items) {
        const collectionIds = [groupCollectionId, ...(unitCollectionId ? [unitCollectionId] : []), ...(options.extraCollectionIds ?? [])];
        const imported = await this.importItem(sql, languagePairId, unit, group, item, collectionIds, timestamp);
        result.requested += 1;
        if (imported.reused) result.reused += 1;
        else result.added += 1;
      }
    }
    return result;
  }

  private async importItem(
    sql: SqlDatabase,
    languagePairId: string,
    unit: MahandUnit,
    group: MahandGroup,
    item: MahandItem,
    collectionIds: readonly string[],
    timestamp: string,
  ): Promise<{ cardId: string; reused: boolean }> {
    const term = item.term.trim().replace(/\s+/g, ' ');
    const translation = item.translation.trim();
    const normalized = normalize(term);
    const duplicate = await sql.getFirstAsync<{ card_id: string }>(
      `SELECT c.id AS card_id
       FROM terms t
       JOIN senses s ON s.term_id = t.id
       JOIN cards c ON c.sense_id = s.id
       WHERE t.language_pair_id = ?
         AND t.normalized_text = ?
         AND LOWER(TRIM(s.translation)) = ?
         AND t.deleted_at IS NULL
         AND s.deleted_at IS NULL
         AND c.deleted_at IS NULL
       LIMIT 1`,
      languagePairId,
      normalized,
      translation.toLocaleLowerCase(),
    );

    if (duplicate) {
      await this.attachCollections(sql, duplicate.card_id, collectionIds, timestamp);
      return { cardId: duplicate.card_id, reused: true };
    }

    const existingTerm = await sql.getFirstAsync<{ id: string }>(
      `SELECT id FROM terms WHERE language_pair_id = ? AND normalized_text = ? AND deleted_at IS NULL ORDER BY created_at LIMIT 1`,
      languagePairId,
      normalized,
    );
    const termId = existingTerm?.id ?? createId('term');
    const senseId = createId('sense');
    const cardId = createId('card');
    const sourceId = createId('source');
    const occurrenceId = createId('occurrence');

    if (!existingTerm) {
      await sql.runAsync(
        `INSERT INTO terms(id, language_pair_id, text, normalized_text, kind, created_at, updated_at, version, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL)`,
        termId,
        languagePairId,
        term,
        normalized,
        termKind(term),
        timestamp,
        timestamp,
      );
    }

    await sql.runAsync(
      `INSERT INTO senses(id, term_id, translation, definition, part_of_speech, note, image_uri, audio_uri,
        created_at, updated_at, version, deleted_at, pronunciation_text, example_translation)
       VALUES (?, ?, ?, NULL, NULL, ?, NULL, NULL, ?, ?, 1, NULL, NULL, ?)`,
      senseId,
      termId,
      translation,
      `مهند · ${unit.title} · ${group.title} · صفحة ${item.page}`,
      timestamp,
      timestamp,
      item.exampleTranslation.trim() || null,
    );
    await sql.runAsync(
      `INSERT INTO cards(id, sense_id, prompt_mode, created_at, updated_at, version, deleted_at)
       VALUES (?, ?, 'TARGET_TO_MEANING', ?, ?, 1, NULL)`,
      cardId,
      senseId,
      timestamp,
      timestamp,
    );
    await sql.runAsync(
      `INSERT INTO sources(id, type, title, external_id, uri, created_at, updated_at, version, deleted_at)
       VALUES (?, 'GENERATED', ?, ?, NULL, ?, ?, 1, NULL)`,
      sourceId,
      `مهند · ${unit.title} · ${group.title}`,
      item.id,
      timestamp,
      timestamp,
    );
    await sql.runAsync(
      `INSERT INTO source_occurrences(id, source_id, sense_id, original_sentence, page_number, timestamp_seconds, locator,
        created_at, updated_at, version, deleted_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, NULL)`,
      occurrenceId,
      sourceId,
      senseId,
      item.example.trim() || null,
      item.page,
      item.id,
      timestamp,
      timestamp,
    );
    await this.attachCollections(sql, cardId, collectionIds, timestamp);
    return { cardId, reused: false };
  }

  private async attachCollections(
    sql: SqlDatabase,
    cardId: string,
    collectionIds: readonly string[],
    timestamp: string,
  ): Promise<void> {
    for (const collectionId of new Set(collectionIds)) {
      await sql.runAsync(
        `INSERT OR IGNORE INTO collection_items(collection_id, card_id, created_at) VALUES (?, ?, ?)`,
        collectionId,
        cardId,
        timestamp,
      );
    }
  }
}
