import type { SQLiteDatabase } from 'expo-sqlite';

export const LATEST_DATABASE_VERSION = 2;

const MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS language_pairs (
  id TEXT PRIMARY KEY NOT NULL,
  target_language_code TEXT NOT NULL,
  target_language_name TEXT NOT NULL,
  reference_language_code TEXT NOT NULL,
  reference_language_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS terms (
  id TEXT PRIMARY KEY NOT NULL,
  language_pair_id TEXT NOT NULL REFERENCES language_pairs(id),
  text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('WORD', 'PHRASE')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_terms_language_pair ON terms(language_pair_id, normalized_text);

CREATE TABLE IF NOT EXISTS senses (
  id TEXT PRIMARY KEY NOT NULL,
  term_id TEXT NOT NULL REFERENCES terms(id),
  translation TEXT NOT NULL,
  definition TEXT,
  part_of_speech TEXT,
  note TEXT,
  image_uri TEXT,
  audio_uri TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_senses_term ON senses(term_id);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY NOT NULL,
  sense_id TEXT NOT NULL REFERENCES senses(id),
  prompt_mode TEXT NOT NULL DEFAULT 'TARGET_TO_MEANING' CHECK(prompt_mode IN ('TARGET_TO_MEANING')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  UNIQUE(sense_id, prompt_mode)
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS collection_items (
  collection_id TEXT NOT NULL REFERENCES collections(id),
  card_id TEXT NOT NULL REFERENCES cards(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(collection_id, card_id)
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('MANUAL', 'TEXT', 'PDF', 'YOUTUBE', 'URL', 'PHOTO', 'GENERATED')),
  title TEXT,
  external_id TEXT,
  uri TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS source_occurrences (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  sense_id TEXT NOT NULL REFERENCES senses(id),
  original_sentence TEXT,
  page_number INTEGER,
  timestamp_seconds REAL,
  locator TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_source_occurrences_sense ON source_occurrences(sense_id, created_at);

CREATE TABLE IF NOT EXISTS user_card_states (
  card_id TEXT PRIMARY KEY NOT NULL REFERENCES cards(id),
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('NEW', 'LEARNING', 'REVIEW', 'MASTERED')),
  repetitions INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TEXT,
  next_due_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_user_card_states_due ON user_card_states(next_due_at);

CREATE TABLE IF NOT EXISTS review_events (
  id TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL REFERENCES cards(id),
  session_id TEXT NOT NULL,
  grade TEXT NOT NULL CHECK(grade IN ('KNEW', 'FORGOT')),
  reviewed_at TEXT NOT NULL,
  response_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_review_events_card_time ON review_events(card_id, reviewed_at, id);
`;

const MIGRATION_002 = `
ALTER TABLE senses ADD COLUMN pronunciation_text TEXT;
ALTER TABLE senses ADD COLUMN example_translation TEXT;
ALTER TABLE language_pairs ADD COLUMN owner_key TEXT NOT NULL DEFAULT 'guest';
ALTER TABLE collections ADD COLUMN language_pair_id TEXT REFERENCES language_pairs(id);

UPDATE collections
SET language_pair_id = (SELECT id FROM language_pairs WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1)
WHERE language_pair_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_language_pairs_owner ON language_pairs(owner_key, deleted_at, created_at);
CREATE INDEX IF NOT EXISTS idx_collections_language_pair ON collections(language_pair_id, deleted_at, name);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO app_settings(key, value, updated_at)
VALUES ('active_owner_key', 'guest', '2026-08-28T00:00:00.000Z');
INSERT OR IGNORE INTO app_settings(key, value, updated_at)
SELECT 'active_language_pair_id', id, '2026-08-28T00:00:00.000Z'
FROM language_pairs WHERE owner_key = 'guest' AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY NOT NULL,
  language_pair_id TEXT NOT NULL REFERENCES language_pairs(id),
  source_type TEXT NOT NULL,
  source_title TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS import_candidates (
  id TEXT PRIMARY KEY NOT NULL,
  batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  translation TEXT NOT NULL,
  definition TEXT,
  context_sentence TEXT,
  part_of_speech TEXT,
  usefulness_score REAL,
  confidence_score REAL,
  duplicate_kind TEXT CHECK(duplicate_kind IN ('NONE', 'EXACT', 'TERM_ONLY')) NOT NULL DEFAULT 'NONE',
  selected INTEGER NOT NULL DEFAULT 1 CHECK(selected IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_import_candidates_batch ON import_candidates(batch_id, status, selected);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('UPSERT', 'DELETE', 'APPEND')),
  entity_version INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_error_code TEXT,
  UNIQUE(entity_type, entity_id, entity_version, operation)
);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_pending ON sync_outbox(next_attempt_at, created_at);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const DATABASE_MIGRATIONS: readonly { version: number; sql: string }[] = [
  { version: 1, sql: MIGRATION_001 },
  { version: 2, sql: MIGRATION_002 },
];

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  if (currentVersion > LATEST_DATABASE_VERSION) {
    throw new Error(`Database version ${currentVersion} is newer than app version ${LATEST_DATABASE_VERSION}.`);
  }

  for (const migration of DATABASE_MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(migration.sql);
      await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    currentVersion = migration.version;
  }
}
