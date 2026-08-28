export const MIGRATION_003 = `
ALTER TABLE sync_outbox ADD COLUMN owner_key TEXT NOT NULL DEFAULT 'guest';
ALTER TABLE sync_outbox ADD COLUMN last_error_message TEXT;

ALTER TABLE collection_items ADD COLUMN updated_at TEXT;
ALTER TABLE collection_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE collection_items ADD COLUMN deleted_at TEXT;
UPDATE collection_items SET updated_at = created_at WHERE updated_at IS NULL;

CREATE TABLE IF NOT EXISTS sync_dead_letters (
  id TEXT PRIMARY KEY NOT NULL,
  owner_key TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('UPSERT', 'DELETE', 'APPEND')),
  entity_version INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  failed_at TEXT NOT NULL,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_dead_letters_owner ON sync_dead_letters(owner_key, failed_at);

CREATE TABLE IF NOT EXISTS sync_control (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO sync_control(key, value) VALUES ('suppress_outbox', '0');

CREATE TABLE IF NOT EXISTS cloud_preferences (
  owner_key TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  PRIMARY KEY(owner_key, key)
);

CREATE TRIGGER IF NOT EXISTS sync_language_pairs_insert
AFTER INSERT ON language_pairs
WHEN (SELECT value FROM sync_control WHERE key = 'suppress_outbox') = '0' AND NEW.owner_key <> 'guest'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id, entity_type, entity_id, operation, entity_version, payload_json, created_at, attempt_count, next_attempt_at, last_error_code, owner_key, last_error_message)
  VALUES ('language_pairs:' || NEW.id || ':' || NEW.version || ':UPSERT', 'language_pairs', NEW.id, 'UPSERT', NEW.version,
    json_object('id',NEW.id,'target_language_code',NEW.target_language_code,'target_language_name',NEW.target_language_name,'reference_language_code',NEW.reference_language_code,'reference_language_name',NEW.reference_language_name,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version,'deleted_at',NEW.deleted_at),
    NEW.updated_at,0,NULL,NULL,NEW.owner_key,NULL);
END;
CREATE TRIGGER IF NOT EXISTS sync_language_pairs_update
AFTER UPDATE ON language_pairs
WHEN (SELECT value FROM sync_control WHERE key = 'suppress_outbox') = '0' AND NEW.owner_key <> 'guest'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id, entity_type, entity_id, operation, entity_version, payload_json, created_at, attempt_count, next_attempt_at, last_error_code, owner_key, last_error_message)
  VALUES ('language_pairs:' || NEW.id || ':' || NEW.version || ':' || CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,
    'language_pairs',NEW.id,CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,NEW.version,
    json_object('id',NEW.id,'target_language_code',NEW.target_language_code,'target_language_name',NEW.target_language_name,'reference_language_code',NEW.reference_language_code,'reference_language_name',NEW.reference_language_name,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version,'deleted_at',NEW.deleted_at),
    NEW.updated_at,0,NULL,NULL,NEW.owner_key,NULL);
END;

CREATE TRIGGER IF NOT EXISTS sync_terms_insert
AFTER INSERT ON terms
WHEN (SELECT value FROM sync_control WHERE key = 'suppress_outbox') = '0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id, entity_type, entity_id, operation, entity_version, payload_json, created_at, attempt_count, next_attempt_at, last_error_code, owner_key, last_error_message)
  SELECT 'terms:'||NEW.id||':'||NEW.version||':UPSERT','terms',NEW.id,'UPSERT',NEW.version,
    json_object('id',NEW.id,'language_pair_id',NEW.language_pair_id,'text',NEW.text,'normalized_text',NEW.normalized_text,'kind',NEW.kind,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version,'deleted_at',NEW.deleted_at),
    NEW.updated_at,0,NULL,NULL,lp.owner_key,NULL FROM language_pairs lp WHERE lp.id=NEW.language_pair_id AND lp.owner_key<>'guest';
END;
CREATE TRIGGER IF NOT EXISTS sync_terms_update
AFTER UPDATE ON terms
WHEN (SELECT value FROM sync_control WHERE key = 'suppress_outbox') = '0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id, entity_type, entity_id, operation, entity_version, payload_json, created_at, attempt_count, next_attempt_at, last_error_code, owner_key, last_error_message)
  SELECT 'terms:'||NEW.id||':'||NEW.version||':'||CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,'terms',NEW.id,CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,NEW.version,
    json_object('id',NEW.id,'language_pair_id',NEW.language_pair_id,'text',NEW.text,'normalized_text',NEW.normalized_text,'kind',NEW.kind,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version,'deleted_at',NEW.deleted_at),
    NEW.updated_at,0,NULL,NULL,lp.owner_key,NULL FROM language_pairs lp WHERE lp.id=NEW.language_pair_id AND lp.owner_key<>'guest';
END;

CREATE TRIGGER IF NOT EXISTS sync_senses_insert
AFTER INSERT ON senses WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'senses:'||NEW.id||':'||NEW.version||':UPSERT','senses',NEW.id,'UPSERT',NEW.version,
    json_object('id',NEW.id,'term_id',NEW.term_id,'translation',NEW.translation,'definition',NEW.definition,'part_of_speech',NEW.part_of_speech,'pronunciation_text',NEW.pronunciation_text,'example_translation',NEW.example_translation,'note',NEW.note,'image_uri',NEW.image_uri,'audio_uri',NEW.audio_uri,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version,'deleted_at',NEW.deleted_at),NEW.updated_at,0,NULL,NULL,lp.owner_key,NULL
  FROM terms t JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE t.id=NEW.term_id AND lp.owner_key<>'guest';
END;
CREATE TRIGGER IF NOT EXISTS sync_senses_update
AFTER UPDATE ON senses WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'senses:'||NEW.id||':'||NEW.version||':'||CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,'senses',NEW.id,CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,NEW.version,
    json_object('id',NEW.id,'term_id',NEW.term_id,'translation',NEW.translation,'definition',NEW.definition,'part_of_speech',NEW.part_of_speech,'pronunciation_text',NEW.pronunciation_text,'example_translation',NEW.example_translation,'note',NEW.note,'image_uri',NEW.image_uri,'audio_uri',NEW.audio_uri,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version,'deleted_at',NEW.deleted_at),NEW.updated_at,0,NULL,NULL,lp.owner_key,NULL
  FROM terms t JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE t.id=NEW.term_id AND lp.owner_key<>'guest';
END;

CREATE TRIGGER IF NOT EXISTS sync_cards_insert
AFTER INSERT ON cards WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'cards:'||NEW.id||':'||NEW.version||':UPSERT','cards',NEW.id,'UPSERT',NEW.version,
    json_object('id',NEW.id,'sense_id',NEW.sense_id,'prompt_mode',NEW.prompt_mode,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version,'deleted_at',NEW.deleted_at),NEW.updated_at,0,NULL,NULL,lp.owner_key,NULL
  FROM senses s JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE s.id=NEW.sense_id AND lp.owner_key<>'guest';
END;
CREATE TRIGGER IF NOT EXISTS sync_cards_update
AFTER UPDATE ON cards WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'cards:'||NEW.id||':'||NEW.version||':'||CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,'cards',NEW.id,CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,NEW.version,
    json_object('id',NEW.id,'sense_id',NEW.sense_id,'prompt_mode',NEW.prompt_mode,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version,'deleted_at',NEW.deleted_at),NEW.updated_at,0,NULL,NULL,lp.owner_key,NULL
  FROM senses s JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE s.id=NEW.sense_id AND lp.owner_key<>'guest';
END;

CREATE TRIGGER IF NOT EXISTS sync_collections_insert
AFTER INSERT ON collections WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'collections:'||NEW.id||':'||NEW.version||':UPSERT','collections',NEW.id,'UPSERT',NEW.version,
    json_object('id',NEW.id,'language_pair_id',NEW.language_pair_id,'name',NEW.name,'description',NEW.description,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version,'deleted_at',NEW.deleted_at),NEW.updated_at,0,NULL,NULL,lp.owner_key,NULL
  FROM language_pairs lp WHERE lp.id=NEW.language_pair_id AND lp.owner_key<>'guest';
END;
CREATE TRIGGER IF NOT EXISTS sync_collections_update
AFTER UPDATE ON collections WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'collections:'||NEW.id||':'||NEW.version||':'||CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,'collections',NEW.id,CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,NEW.version,
    json_object('id',NEW.id,'language_pair_id',NEW.language_pair_id,'name',NEW.name,'description',NEW.description,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version,'deleted_at',NEW.deleted_at),NEW.updated_at,0,NULL,NULL,lp.owner_key,NULL
  FROM language_pairs lp WHERE lp.id=NEW.language_pair_id AND lp.owner_key<>'guest';
END;

CREATE TRIGGER IF NOT EXISTS sync_collection_items_insert
AFTER INSERT ON collection_items WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'collection_items:'||NEW.collection_id||':'||NEW.card_id||':'||NEW.version||':UPSERT','collection_items',NEW.collection_id||':'||NEW.card_id,'UPSERT',NEW.version,
    json_object('collection_id',NEW.collection_id,'card_id',NEW.card_id,'created_at',NEW.created_at,'updated_at',COALESCE(NEW.updated_at,NEW.created_at),'version',NEW.version,'deleted_at',NEW.deleted_at),COALESCE(NEW.updated_at,NEW.created_at),0,NULL,NULL,lp.owner_key,NULL
  FROM collections col JOIN language_pairs lp ON lp.id=col.language_pair_id WHERE col.id=NEW.collection_id AND lp.owner_key<>'guest';
END;
CREATE TRIGGER IF NOT EXISTS sync_collection_items_update
AFTER UPDATE ON collection_items WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'collection_items:'||NEW.collection_id||':'||NEW.card_id||':'||NEW.version||':'||CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,'collection_items',NEW.collection_id||':'||NEW.card_id,CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,NEW.version,
    json_object('collection_id',NEW.collection_id,'card_id',NEW.card_id,'created_at',NEW.created_at,'updated_at',COALESCE(NEW.updated_at,NEW.created_at),'version',NEW.version,'deleted_at',NEW.deleted_at),COALESCE(NEW.updated_at,NEW.created_at),0,NULL,NULL,lp.owner_key,NULL
  FROM collections col JOIN language_pairs lp ON lp.id=col.language_pair_id WHERE col.id=NEW.collection_id AND lp.owner_key<>'guest';
END;

CREATE TRIGGER IF NOT EXISTS sync_source_occurrences_insert
AFTER INSERT ON source_occurrences WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'sources:'||src.id||':'||src.version||':UPSERT','sources',src.id,'UPSERT',src.version,
    json_object('id',src.id,'type',src.type,'title',src.title,'external_id',src.external_id,'uri',src.uri,'created_at',src.created_at,'updated_at',src.updated_at,'version',src.version,'deleted_at',src.deleted_at),src.updated_at,0,NULL,NULL,lp.owner_key,NULL
  FROM sources src JOIN senses s ON s.id=NEW.sense_id JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE src.id=NEW.source_id AND lp.owner_key<>'guest';
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'source_occurrences:'||NEW.id||':'||NEW.version||':UPSERT','source_occurrences',NEW.id,'UPSERT',NEW.version,
    json_object('id',NEW.id,'source_id',NEW.source_id,'sense_id',NEW.sense_id,'original_sentence',NEW.original_sentence,'page_number',NEW.page_number,'timestamp_seconds',NEW.timestamp_seconds,'locator',NEW.locator,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version,'deleted_at',NEW.deleted_at),NEW.updated_at,0,NULL,NULL,lp.owner_key,NULL
  FROM senses s JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE s.id=NEW.sense_id AND lp.owner_key<>'guest';
END;
CREATE TRIGGER IF NOT EXISTS sync_source_occurrences_update
AFTER UPDATE ON source_occurrences WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'source_occurrences:'||NEW.id||':'||NEW.version||':'||CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,'source_occurrences',NEW.id,CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,NEW.version,
    json_object('id',NEW.id,'source_id',NEW.source_id,'sense_id',NEW.sense_id,'original_sentence',NEW.original_sentence,'page_number',NEW.page_number,'timestamp_seconds',NEW.timestamp_seconds,'locator',NEW.locator,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version,'deleted_at',NEW.deleted_at),NEW.updated_at,0,NULL,NULL,lp.owner_key,NULL
  FROM senses s JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE s.id=NEW.sense_id AND lp.owner_key<>'guest';
END;

CREATE TRIGGER IF NOT EXISTS sync_user_card_states_insert
AFTER INSERT ON user_card_states WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'user_card_states:'||NEW.card_id||':'||NEW.version||':UPSERT','user_card_states',NEW.card_id,'UPSERT',NEW.version,
    json_object('card_id',NEW.card_id,'lifecycle',NEW.lifecycle,'repetitions',NEW.repetitions,'lapses',NEW.lapses,'last_reviewed_at',NEW.last_reviewed_at,'next_due_at',NEW.next_due_at,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version),NEW.updated_at,0,NULL,NULL,lp.owner_key,NULL
  FROM cards c JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE c.id=NEW.card_id AND lp.owner_key<>'guest';
END;
CREATE TRIGGER IF NOT EXISTS sync_user_card_states_update
AFTER UPDATE ON user_card_states WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'user_card_states:'||NEW.card_id||':'||NEW.version||':UPSERT','user_card_states',NEW.card_id,'UPSERT',NEW.version,
    json_object('card_id',NEW.card_id,'lifecycle',NEW.lifecycle,'repetitions',NEW.repetitions,'lapses',NEW.lapses,'last_reviewed_at',NEW.last_reviewed_at,'next_due_at',NEW.next_due_at,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version),NEW.updated_at,0,NULL,NULL,lp.owner_key,NULL
  FROM cards c JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE c.id=NEW.card_id AND lp.owner_key<>'guest';
END;

CREATE TRIGGER IF NOT EXISTS sync_review_events_insert
AFTER INSERT ON review_events WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR IGNORE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'review_events:'||NEW.id||':1:APPEND','review_events',NEW.id,'APPEND',1,
    json_object('id',NEW.id,'card_id',NEW.card_id,'session_id',NEW.session_id,'grade',NEW.grade,'reviewed_at',NEW.reviewed_at,'response_ms',NEW.response_ms,'created_at',NEW.reviewed_at),NEW.reviewed_at,0,NULL,NULL,lp.owner_key,NULL
  FROM cards c JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE c.id=NEW.card_id AND lp.owner_key<>'guest';
END;

CREATE TRIGGER IF NOT EXISTS sync_cloud_preferences_insert
AFTER INSERT ON cloud_preferences WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0' AND NEW.owner_key<>'guest'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  VALUES ('app_settings:'||NEW.key||':'||NEW.version||':UPSERT','app_settings',NEW.key,'UPSERT',NEW.version,
    json_object('key',NEW.key,'value_json',json(NEW.value_json),'updated_at',NEW.updated_at,'version',NEW.version),NEW.updated_at,0,NULL,NULL,NEW.owner_key,NULL);
END;
CREATE TRIGGER IF NOT EXISTS sync_cloud_preferences_update
AFTER UPDATE ON cloud_preferences WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0' AND NEW.owner_key<>'guest'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  VALUES ('app_settings:'||NEW.key||':'||NEW.version||':'||CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,'app_settings',NEW.key,CASE WHEN NEW.deleted_at IS NULL THEN 'UPSERT' ELSE 'DELETE' END,NEW.version,
    json_object('key',NEW.key,'value_json',json(NEW.value_json),'updated_at',NEW.updated_at,'version',NEW.version,'deleted_at',NEW.deleted_at),NEW.updated_at,0,NULL,NULL,NEW.owner_key,NULL);
END;
`;
