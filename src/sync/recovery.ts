import type { SQLiteDatabase } from 'expo-sqlite';
import { asSqlDatabase } from '@/data/database';
import { RemoteChangeApplier } from './local-applier';
import { SyncOutboxRepository } from './outbox';
import type { SyncTransport } from './types';

const PULL_BATCH = 100;
const MAX_RESTORE_PAGES = 200;

export class SyncRecoveryService {
  constructor(private readonly sqlite: SQLiteDatabase) {}

  async retryAllBlocked(ownerKey: string): Promise<number> {
    const db = asSqlDatabase(this.sqlite);
    const outbox = new SyncOutboxRepository(db);
    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM sync_dead_letters WHERE owner_key = ? ORDER BY failed_at ASC',
      ownerKey,
    );
    let retried = 0;
    for (const row of rows) {
      if (await outbox.retryBlocked(row.id)) retried += 1;
    }
    return retried;
  }

  async resetLocalAndRestore(
    ownerKey: string,
    clientId: string,
    transport: SyncTransport,
  ): Promise<{ restored: number; cursor: number }> {
    if (ownerKey === 'guest') throw new Error('Guest data has no cloud backup to restore.');
    const db = asSqlDatabase(this.sqlite);
    const outbox = new SyncOutboxRepository(db);

    await this.sqlite.withExclusiveTransactionAsync(async (txn) => {
      const sql = asSqlDatabase(txn);
      await sql.runAsync("UPDATE sync_control SET value='1' WHERE key='suppress_outbox'");
      try {
        await sql.execAsync('CREATE TEMP TABLE IF NOT EXISTS restore_source_ids(id TEXT PRIMARY KEY); DELETE FROM restore_source_ids;');
        await sql.runAsync(`INSERT OR IGNORE INTO restore_source_ids(id)
          SELECT DISTINCT so.source_id FROM source_occurrences so
          JOIN senses s ON s.id=so.sense_id
          JOIN terms t ON t.id=s.term_id
          JOIN language_pairs lp ON lp.id=t.language_pair_id
          WHERE lp.owner_key = ?`, ownerKey);
        await sql.runAsync(`DELETE FROM review_events WHERE card_id IN (
          SELECT c.id FROM cards c JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE lp.owner_key=?
        )`, ownerKey);
        await sql.runAsync(`DELETE FROM user_card_states WHERE card_id IN (
          SELECT c.id FROM cards c JOIN senses s ON s.id=c.sense_id JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE lp.owner_key=?
        )`, ownerKey);
        await sql.runAsync(`DELETE FROM collection_items WHERE collection_id IN (
          SELECT col.id FROM collections col JOIN language_pairs lp ON lp.id=col.language_pair_id WHERE lp.owner_key=?
        )`, ownerKey);
        await sql.runAsync(`DELETE FROM source_occurrences WHERE sense_id IN (
          SELECT s.id FROM senses s JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE lp.owner_key=?
        )`, ownerKey);
        await sql.runAsync('DELETE FROM sources WHERE id IN (SELECT id FROM restore_source_ids)');
        await sql.runAsync(`DELETE FROM cards WHERE sense_id IN (
          SELECT s.id FROM senses s JOIN terms t ON t.id=s.term_id JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE lp.owner_key=?
        )`, ownerKey);
        await sql.runAsync(`DELETE FROM senses WHERE term_id IN (
          SELECT t.id FROM terms t JOIN language_pairs lp ON lp.id=t.language_pair_id WHERE lp.owner_key=?
        )`, ownerKey);
        await sql.runAsync('DELETE FROM terms WHERE language_pair_id IN (SELECT id FROM language_pairs WHERE owner_key=?)', ownerKey);
        await sql.runAsync('DELETE FROM collections WHERE language_pair_id IN (SELECT id FROM language_pairs WHERE owner_key=?)', ownerKey);
        await sql.runAsync('DELETE FROM language_pairs WHERE owner_key=?', ownerKey);
        await sql.runAsync('DELETE FROM cloud_preferences WHERE owner_key=?', ownerKey);
        await sql.runAsync('DELETE FROM sync_outbox WHERE owner_key=?', ownerKey);
        await sql.runAsync('DELETE FROM sync_dead_letters WHERE owner_key=?', ownerKey);
        await sql.runAsync('DELETE FROM sync_meta WHERE key=?', `pull_cursor:${ownerKey}`);
      } finally {
        await sql.runAsync("UPDATE sync_control SET value='0' WHERE key='suppress_outbox'");
      }
    });

    const applier = new RemoteChangeApplier(this.sqlite);
    let cursor = 0;
    let restored = 0;
    for (let pageIndex = 0; pageIndex < MAX_RESTORE_PAGES; pageIndex += 1) {
      const page = await transport.pullChanges(ownerKey, clientId, cursor, PULL_BATCH);
      restored += await applier.apply(ownerKey, page.changes);
      cursor = page.nextCursor;
      await outbox.setPullCursor(ownerKey, cursor);
      if (!page.hasMore) break;
      if (pageIndex === MAX_RESTORE_PAGES - 1) {
        throw new Error('Cloud restore exceeded the safe page limit. Try again after syncing on another device.');
      }
    }
    await db.runAsync(`INSERT INTO sync_meta(key,value,updated_at) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
      `bootstrap_complete:${ownerKey}`, '1', new Date().toISOString());
    await outbox.markLastSynced(ownerKey);
    return { restored, cursor };
  }
}
