import type { SQLiteDatabase } from 'expo-sqlite';
import type { Card, LanguagePair, Sense, Source, SourceOccurrence, Term, UserCardState } from '@/domain/types';
import { asSqlDatabase } from './database';
import { UserCardStateRepository, VocabularyRepository } from './repositories';

const SEED_TIME = '2026-08-01T09:00:00.000Z';
const OVERDUE_TIME = '2026-08-20T09:00:00.000Z';

const EN_AR: LanguagePair = {
  id: 'demo-lp-en-ar',
  targetLanguageCode: 'en',
  targetLanguageName: 'English',
  referenceLanguageCode: 'ar',
  referenceLanguageName: 'Arabic',
  createdAt: SEED_TIME,
  updatedAt: SEED_TIME,
  version: 1,
  deletedAt: null,
};

const sourceManual: Source = {
  id: 'demo-source-manual', type: 'MANUAL', title: 'Quick add', externalId: null, uri: null,
  createdAt: SEED_TIME, updatedAt: SEED_TIME, version: 1, deletedAt: null,
};
const sourceVideo: Source = {
  id: 'demo-source-video', type: 'YOUTUBE', title: 'Everyday English — demo source', externalId: 'demo-video', uri: 'https://example.invalid/demo-video',
  createdAt: SEED_TIME, updatedAt: SEED_TIME, version: 1, deletedAt: null,
};
const sourcePdf: Source = {
  id: 'demo-source-pdf', type: 'PDF', title: 'Short Story — demo source', externalId: 'demo-story.pdf', uri: null,
  createdAt: SEED_TIME, updatedAt: SEED_TIME, version: 1, deletedAt: null,
};

type SeedEntry = {
  term: Term;
  senses: Array<{ sense: Sense; card: Card; occurrence: SourceOccurrence }>;
};

function baseTerm(id: string, text: string, kind: Term['kind'], createdAt: string): Term {
  return { id, languagePairId: EN_AR.id, text, normalizedText: text.toLocaleLowerCase('en'), kind, createdAt, updatedAt: SEED_TIME, version: 1, deletedAt: null };
}
function baseSense(id: string, termId: string, translation: string, definition: string, partOfSpeech: string, note: string | null, createdAt: string): Sense {
  return { id, termId, translation, definition, partOfSpeech, note, imageUri: null, audioUri: null, createdAt, updatedAt: SEED_TIME, version: 1, deletedAt: null };
}
function baseCard(id: string, senseId: string, createdAt: string): Card {
  return { id, senseId, promptMode: 'TARGET_TO_MEANING', createdAt, updatedAt: SEED_TIME, version: 1, deletedAt: null };
}
function occurrence(id: string, sourceId: string, senseId: string, sentence: string | null, createdAt: string, pageNumber: number | null = null, timestampSeconds: number | null = null): SourceOccurrence {
  return { id, sourceId, senseId, originalSentence: sentence, pageNumber, timestampSeconds, locator: pageNumber ? `page:${pageNumber}` : timestampSeconds ? `second:${timestampSeconds}` : null, createdAt, updatedAt: SEED_TIME, version: 1, deletedAt: null };
}

const seedEntries: SeedEntry[] = [
  {
    term: baseTerm('demo-term-car', 'car', 'WORD', '2026-08-01T09:01:00.000Z'),
    senses: [{
      sense: baseSense('demo-sense-car', 'demo-term-car', 'سيارة', 'a road vehicle with an engine', 'noun', null, '2026-08-01T09:01:00.000Z'),
      card: baseCard('demo-card-car', 'demo-sense-car', '2026-08-01T09:01:00.000Z'),
      occurrence: occurrence('demo-occurrence-car', sourceManual.id, 'demo-sense-car', 'I left my car outside.', '2026-08-01T09:01:00.000Z'),
    }],
  },
  {
    term: baseTerm('demo-term-run', 'run', 'WORD', '2026-08-01T09:02:00.000Z'),
    senses: [
      {
        sense: baseSense('demo-sense-run-jog', 'demo-term-run', 'يجري', 'to move quickly on foot', 'verb', 'Physical movement sense.', '2026-08-01T09:02:00.000Z'),
        card: baseCard('demo-card-run-jog', 'demo-sense-run-jog', '2026-08-01T09:02:00.000Z'),
        occurrence: occurrence('demo-occurrence-run-jog', sourceVideo.id, 'demo-sense-run-jog', 'I run before work three times a week.', '2026-08-01T09:02:00.000Z', null, 82),
      },
      {
        sense: baseSense('demo-sense-run-operate', 'demo-term-run', 'يدير / يشغّل', 'to operate or manage something', 'verb', 'Different sense of the same surface term.', '2026-08-01T09:03:00.000Z'),
        card: baseCard('demo-card-run-operate', 'demo-sense-run-operate', '2026-08-01T09:03:00.000Z'),
        occurrence: occurrence('demo-occurrence-run-operate', sourceVideo.id, 'demo-sense-run-operate', 'She runs a small design studio.', '2026-08-01T09:03:00.000Z', null, 147),
      },
    ],
  },
  {
    term: baseTerm('demo-term-reluctant', 'reluctant', 'WORD', '2026-08-01T09:04:00.000Z'),
    senses: [{
      sense: baseSense('demo-sense-reluctant', 'demo-term-reluctant', 'متردد / غير راغب', 'not willing and therefore slow to do something', 'adjective', 'Context is more useful than a generic image for this word.', '2026-08-01T09:04:00.000Z'),
      card: baseCard('demo-card-reluctant', 'demo-sense-reluctant', '2026-08-01T09:04:00.000Z'),
      occurrence: occurrence('demo-occurrence-reluctant', sourcePdf.id, 'demo-sense-reluctant', 'She was reluctant to speak in front of the group.', '2026-08-01T09:04:00.000Z', 7),
    }],
  },
  {
    term: baseTerm('demo-term-look-forward', 'look forward to', 'PHRASE', '2026-08-01T09:05:00.000Z'),
    senses: [{
      sense: baseSense('demo-sense-look-forward', 'demo-term-look-forward', 'يتطلع إلى', 'to feel pleased and excited about something that is going to happen', 'phrasal expression', 'Usually followed by a noun or -ing form.', '2026-08-01T09:05:00.000Z'),
      card: baseCard('demo-card-look-forward', 'demo-sense-look-forward', '2026-08-01T09:05:00.000Z'),
      occurrence: occurrence('demo-occurrence-look-forward', sourceVideo.id, 'demo-sense-look-forward', 'I look forward to hearing from you.', '2026-08-01T09:05:00.000Z', null, 341),
    }],
  },
  {
    term: baseTerm('demo-term-long', 'pneumonoultramicroscopicsilicovolcanoconiosis', 'WORD', '2026-08-01T09:06:00.000Z'),
    senses: [{
      sense: baseSense('demo-sense-long', 'demo-term-long', 'مرض رئوي ناتج عن استنشاق غبار السيليكا الدقيق', 'an intentionally extreme long-word layout stress case', 'noun', 'Developer layout edge case.', '2026-08-01T09:06:00.000Z'),
      card: baseCard('demo-card-long', 'demo-sense-long', '2026-08-01T09:06:00.000Z'),
      occurrence: occurrence('demo-occurrence-long', sourceManual.id, 'demo-sense-long', null, '2026-08-01T09:06:00.000Z'),
    }],
  },
];

const overdueState: UserCardState = {
  cardId: 'demo-card-car', lifecycle: 'REVIEW', repetitions: 3, lapses: 1,
  lastReviewedAt: '2026-08-18T09:00:00.000Z', nextDueAt: OVERDUE_TIME,
  createdAt: SEED_TIME, updatedAt: '2026-08-18T09:00:00.000Z', version: 4,
};

export async function resetAndSeedDemoDatabase(db: SQLiteDatabase): Promise<void> {
  if (!__DEV__) throw new Error('Demo reset is disabled outside development builds.');

  await db.withExclusiveTransactionAsync(async (txn) => {
    const sqlDb = asSqlDatabase(txn);
    await txn.execAsync(`
      DELETE FROM review_events;
      DELETE FROM user_card_states;
      DELETE FROM collection_items;
      DELETE FROM source_occurrences;
      DELETE FROM sources;
      DELETE FROM cards;
      DELETE FROM senses;
      DELETE FROM terms;
      DELETE FROM collections;
      DELETE FROM language_pairs;
    `);

    const vocabulary = new VocabularyRepository(sqlDb);
    const states = new UserCardStateRepository(sqlDb);
    await vocabulary.insertLanguagePair(EN_AR);
    await vocabulary.insertSource(sourceManual);
    await vocabulary.insertSource(sourceVideo);
    await vocabulary.insertSource(sourcePdf);
    await vocabulary.insertCollection({
      id: 'demo-collection-core', name: 'Demo vocabulary', description: 'Deterministic development seed pack',
      createdAt: SEED_TIME, updatedAt: SEED_TIME, version: 1, deletedAt: null,
    });

    for (const entry of seedEntries) {
      await vocabulary.insertTerm(entry.term);
      for (const item of entry.senses) {
        await vocabulary.insertSense(item.sense);
        await vocabulary.insertCard(item.card);
        await vocabulary.insertSourceOccurrence(item.occurrence);
        await vocabulary.addCardToCollection('demo-collection-core', item.card.id, item.card.createdAt);
      }
    }
    await states.upsert(overdueState);
  });
}

export async function ensureDemoSeedIfEmpty(db: SQLiteDatabase): Promise<void> {
  if (!__DEV__) return;
  const vocabulary = new VocabularyRepository(asSqlDatabase(db));
  if ((await vocabulary.countCards()) === 0) await resetAndSeedDemoDatabase(db);
}
