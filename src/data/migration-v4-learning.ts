export const MIGRATION_004 = `
ALTER TABLE user_card_states ADD COLUMN stability REAL NOT NULL DEFAULT 0;
ALTER TABLE user_card_states ADD COLUMN difficulty REAL NOT NULL DEFAULT 0;
ALTER TABLE user_card_states ADD COLUMN elapsed_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_card_states ADD COLUMN scheduled_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_card_states ADD COLUMN learning_steps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_card_states ADD COLUMN fsrs_state INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_card_states ADD COLUMN scheduler_version TEXT NOT NULL DEFAULT 'simple-v1';

ALTER TABLE review_events ADD COLUMN recall_mode TEXT NOT NULL DEFAULT 'TARGET_TO_MEANING';
ALTER TABLE review_events ADD COLUMN mode_result TEXT NOT NULL DEFAULT 'SELF_GRADED';
ALTER TABLE review_events ADD COLUMN scheduler_rating INTEGER;

DROP TRIGGER IF EXISTS sync_user_card_states_insert;
DROP TRIGGER IF EXISTS sync_user_card_states_update;
CREATE TRIGGER sync_user_card_states_insert
AFTER INSERT ON user_card_states WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'user_card_states:'||NEW.card_id||':'||NEW.version||':UPSERT','user_card_states',NEW.card_id,'UPSERT',NEW.version,
    json_object('card_id',NEW.card_id,'lifecycle',NEW.lifecycle,'repetitions',NEW.repetitions,'lapses',NEW.lapses,'last_reviewed_at',NEW.last_reviewed_at,'next_due_at',NEW.next_due_at,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version,'stability',NEW.stability,'difficulty',NEW.difficulty,'elapsed_days',NEW.elapsed_days,'scheduled_days',NEW.scheduled_days,'learning_steps',NEW.learning_steps,'fsrs_state',NEW.fsrs_state,'scheduler_version',NEW.scheduler_version),NEW.updated_at,0,NULL,NULL,lp.owner_key,NULL
  FROM cards c JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE c.id=NEW.card_id AND lp.owner_key<>'guest';
END;
CREATE TRIGGER sync_user_card_states_update
AFTER UPDATE ON user_card_states WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'user_card_states:'||NEW.card_id||':'||NEW.version||':UPSERT','user_card_states',NEW.card_id,'UPSERT',NEW.version,
    json_object('card_id',NEW.card_id,'lifecycle',NEW.lifecycle,'repetitions',NEW.repetitions,'lapses',NEW.lapses,'last_reviewed_at',NEW.last_reviewed_at,'next_due_at',NEW.next_due_at,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'version',NEW.version,'stability',NEW.stability,'difficulty',NEW.difficulty,'elapsed_days',NEW.elapsed_days,'scheduled_days',NEW.scheduled_days,'learning_steps',NEW.learning_steps,'fsrs_state',NEW.fsrs_state,'scheduler_version',NEW.scheduler_version),NEW.updated_at,0,NULL,NULL,lp.owner_key,NULL
  FROM cards c JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE c.id=NEW.card_id AND lp.owner_key<>'guest';
END;

DROP TRIGGER IF EXISTS sync_review_events_insert;
CREATE TRIGGER sync_review_events_insert
AFTER INSERT ON review_events WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR IGNORE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'review_events:'||NEW.id||':1:APPEND','review_events',NEW.id,'APPEND',1,
    json_object('id',NEW.id,'card_id',NEW.card_id,'session_id',NEW.session_id,'grade',NEW.grade,'reviewed_at',NEW.reviewed_at,'response_ms',NEW.response_ms,'created_at',NEW.reviewed_at,'recall_mode',NEW.recall_mode,'mode_result',NEW.mode_result,'scheduler_rating',NEW.scheduler_rating),NEW.reviewed_at,0,NULL,NULL,lp.owner_key,NULL
  FROM cards c JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE c.id=NEW.card_id AND lp.owner_key<>'guest';
END;

CREATE TRIGGER IF NOT EXISTS sync_collection_items_delete
AFTER DELETE ON collection_items WHEN (SELECT value FROM sync_control WHERE key='suppress_outbox')='0'
BEGIN
  INSERT OR REPLACE INTO sync_outbox(id,entity_type,entity_id,operation,entity_version,payload_json,created_at,attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message)
  SELECT 'collection_items:'||OLD.collection_id||':'||OLD.card_id||':'||(OLD.version+1)||':DELETE','collection_items',OLD.collection_id||'|'||OLD.card_id,'DELETE',OLD.version+1,
    json_object('collection_id',OLD.collection_id,'card_id',OLD.card_id,'created_at',OLD.created_at,'updated_at',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'version',OLD.version+1,'deleted_at',strftime('%Y-%m-%dT%H:%M:%fZ','now')),strftime('%Y-%m-%dT%H:%M:%fZ','now'),0,NULL,NULL,lp.owner_key,NULL
  FROM collections col JOIN language_pairs lp ON lp.id=col.language_pair_id WHERE col.id=OLD.collection_id AND lp.owner_key<>'guest';
END;
`;
