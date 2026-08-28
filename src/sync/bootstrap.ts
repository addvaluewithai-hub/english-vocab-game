import type { SqlDatabase } from '@/data/database';

export async function ensureSyncBootstrap(
  db: SqlDatabase,
  ownerKey: string,
  now = new Date(),
): Promise<boolean> {
  if (ownerKey === 'guest') return false;
  const marker = `bootstrap_complete:${ownerKey}`;
  const existing = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_meta WHERE key = ?', marker,
  );
  if (existing?.value === '1') return false;

  // Touch rows without changing versions. AFTER UPDATE triggers serialize the
  // canonical row into the durable outbox in dependency order.
  await db.runAsync('UPDATE language_pairs SET updated_at = updated_at WHERE owner_key = ?', ownerKey);
  await db.runAsync(`UPDATE terms SET updated_at = updated_at WHERE language_pair_id IN (
    SELECT id FROM language_pairs WHERE owner_key = ?
  )`, ownerKey);
  await db.runAsync(`UPDATE senses SET updated_at = updated_at WHERE term_id IN (
    SELECT t.id FROM terms t JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE lp.owner_key = ?
  )`, ownerKey);
  await db.runAsync(`UPDATE cards SET updated_at = updated_at WHERE sense_id IN (
    SELECT s.id FROM senses s JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE lp.owner_key = ?
  )`, ownerKey);
  await db.runAsync(`UPDATE collections SET updated_at = updated_at WHERE language_pair_id IN (
    SELECT id FROM language_pairs WHERE owner_key = ?
  )`, ownerKey);
  await db.runAsync(`UPDATE collection_items SET updated_at = COALESCE(updated_at, created_at) WHERE collection_id IN (
    SELECT col.id FROM collections col JOIN language_pairs lp ON lp.id=col.language_pair_id WHERE lp.owner_key = ?
  )`, ownerKey);
  await db.runAsync(`UPDATE source_occurrences SET updated_at = updated_at WHERE sense_id IN (
    SELECT s.id FROM senses s JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE lp.owner_key = ?
  )`, ownerKey);
  await db.runAsync(`UPDATE user_card_states SET updated_at = updated_at WHERE card_id IN (
    SELECT c.id FROM cards c JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE lp.owner_key = ?
  )`, ownerKey);

  // Review history is append-only, so bootstrap it directly rather than
  // touching historical rows.
  await db.runAsync(`INSERT OR IGNORE INTO sync_outbox(
      id,entity_type,entity_id,operation,entity_version,payload_json,created_at,
      attempt_count,next_attempt_at,last_error_code,owner_key,last_error_message
    )
    SELECT 'review_events:'||re.id||':1:APPEND','review_events',re.id,'APPEND',1,
      json_object('id',re.id,'card_id',re.card_id,'session_id',re.session_id,'grade',re.grade,
        'reviewed_at',re.reviewed_at,'response_ms',re.response_ms,'created_at',re.reviewed_at),
      re.reviewed_at,0,NULL,NULL,lp.owner_key,NULL
    FROM review_events re
    JOIN cards c ON c.id=re.card_id
    JOIN senses s ON s.id=c.sense_id
    JOIN terms t ON t.id=s.term_id
    JOIN language_pairs lp ON lp.id=t.language_pair_id
    WHERE lp.owner_key = ?`, ownerKey);

  await db.runAsync('UPDATE cloud_preferences SET updated_at = updated_at WHERE owner_key = ?', ownerKey);
  await db.runAsync(`INSERT INTO sync_meta(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
    marker, '1', now.toISOString());
  return true;
}
