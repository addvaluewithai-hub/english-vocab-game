import type { SQLiteDatabase } from 'expo-sqlite';
import { CatalogRepository, ManualVocabularyService } from '@/data/catalog';
import { asSqlDatabase } from '@/data/database';
import { CURRICULUM_PACKAGES, type CurriculumItem, type CurriculumPackage } from './catalog';

export interface CurriculumSelection {
  packageId: string;
  itemIds: string[];
}

export interface CurriculumImportResult {
  added: number;
  reused: number;
  collectionsCreated: number;
  failedItems: string[];
}

type ExistingCard = {
  card_id: string;
  sense_id: string;
};

const COURSE_SOURCE_URI = 'https://github.com/addvaluewithai-hub/english-course/blob/main/data/reviewed/a1-lexical-chunk-ownership-v1.json';

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function packageCollectionName(pkg: CurriculumPackage): string {
  return `Course · ${pkg.level} · ${pkg.title}`;
}

function packageCollectionDescription(pkg: CurriculumPackage): string {
  return `${pkg.unitTitle} (${pkg.unitTitleAr}) · curated from English Course · ${pkg.id}`;
}

export class CurriculumBankService {
  constructor(private readonly sqlite: SQLiteDatabase) {}

  private async assertEnglishArabicPair(languagePairId: string): Promise<void> {
    const row = await this.sqlite.getFirstAsync<{ target_language_code: string; reference_language_code: string }>(
      `SELECT target_language_code, reference_language_code
       FROM language_pairs
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      languagePairId,
    );
    if (!row) throw new Error('The active language pair no longer exists.');
    if (row.target_language_code !== 'en' || row.reference_language_code !== 'ar') {
      throw new Error('The curated course library currently supports English → Arabic.');
    }
  }

  private async findExactCard(languagePairId: string, item: CurriculumItem): Promise<ExistingCard | null> {
    return this.sqlite.getFirstAsync<ExistingCard>(
      `SELECT c.id AS card_id, s.id AS sense_id
       FROM terms t
       JOIN senses s ON s.term_id = t.id AND s.deleted_at IS NULL
       JOIN cards c ON c.sense_id = s.id AND c.deleted_at IS NULL
       WHERE t.language_pair_id = ?
         AND t.normalized_text = ?
         AND LOWER(TRIM(s.translation)) = ?
         AND t.deleted_at IS NULL
       ORDER BY c.created_at ASC, c.id ASC
       LIMIT 1`,
      languagePairId,
      normalize(item.term),
      item.translation.trim().toLocaleLowerCase(),
    );
  }

  private async ensureCollection(
    languagePairId: string,
    pkg: CurriculumPackage,
  ): Promise<{ id: string; created: boolean }> {
    const repo = new CatalogRepository(asSqlDatabase(this.sqlite));
    const name = packageCollectionName(pkg);
    const existing = (await repo.listCollections(languagePairId)).find((collection) => collection.name === name);
    if (existing) return { id: existing.id, created: false };
    const id = await repo.createCollection(languagePairId, name, packageCollectionDescription(pkg));
    return { id, created: true };
  }

  private async attachCourseProvenance(pkg: CurriculumPackage, item: CurriculumItem, senseId: string): Promise<void> {
    const sourceId = `course-source-${pkg.id}`;
    const occurrenceId = `course-occurrence-${pkg.id}-${item.id}-${senseId}`;
    const timestamp = new Date().toISOString();
    const sourceTitle = `English Course · ${pkg.level} · Unit ${pkg.unitNumber} · ${pkg.title}`;
    const locator = `${item.sourceLexicalItemId} · ${pkg.id}`;

    await this.sqlite.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT OR IGNORE INTO sources(id, type, title, external_id, uri, created_at, updated_at, version, deleted_at)
         VALUES (?, 'URL', ?, ?, ?, ?, ?, 1, NULL)`,
        sourceId,
        sourceTitle,
        pkg.id,
        COURSE_SOURCE_URI,
        timestamp,
        timestamp,
      );
      await txn.runAsync(
        `INSERT OR IGNORE INTO source_occurrences(
           id, source_id, sense_id, original_sentence, page_number, timestamp_seconds, locator,
           created_at, updated_at, version, deleted_at
         ) VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?, ?, 1, NULL)`,
        occurrenceId,
        sourceId,
        senseId,
        locator,
        timestamp,
        timestamp,
      );
    });
  }

  async addSelections(languagePairId: string, selections: readonly CurriculumSelection[]): Promise<CurriculumImportResult> {
    await this.assertEnglishArabicPair(languagePairId);

    const result: CurriculumImportResult = {
      added: 0,
      reused: 0,
      collectionsCreated: 0,
      failedItems: [],
    };
    const catalogRepo = new CatalogRepository(asSqlDatabase(this.sqlite));
    const creator = new ManualVocabularyService(this.sqlite);

    for (const selection of selections) {
      const pkg = CURRICULUM_PACKAGES.find((candidate) => candidate.id === selection.packageId);
      if (!pkg) continue;
      const requested = new Set(selection.itemIds);
      const items = pkg.items.filter((item) => requested.has(item.id));
      if (!items.length) continue;

      const collection = await this.ensureCollection(languagePairId, pkg);
      if (collection.created) result.collectionsCreated += 1;

      for (const item of items) {
        try {
          const existing = await this.findExactCard(languagePairId, item);
          if (existing) {
            await catalogRepo.addToCollection(existing.card_id, collection.id);
            await this.attachCourseProvenance(pkg, item, existing.sense_id);
            result.reused += 1;
            continue;
          }

          const created = await creator.create({
            languagePairId,
            term: item.term,
            kind: item.kind,
            translation: item.translation,
            ...(item.definition ? { definition: item.definition } : {}),
            note: `${pkg.level} · ${pkg.unitTitle} · ${pkg.title}`,
            collectionIds: [collection.id],
          });
          await this.attachCourseProvenance(pkg, item, created.senseId);
          result.added += 1;
        } catch {
          const racedExisting = await this.findExactCard(languagePairId, item);
          if (racedExisting) {
            await catalogRepo.addToCollection(racedExisting.card_id, collection.id);
            await this.attachCourseProvenance(pkg, item, racedExisting.sense_id);
            result.reused += 1;
          } else {
            result.failedItems.push(item.term);
          }
        }
      }
    }

    return result;
  }
}
