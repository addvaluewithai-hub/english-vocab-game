import type { SyncOperation } from './protocol';

export type SyncEntityType =
  | 'language_pairs'
  | 'terms'
  | 'senses'
  | 'cards'
  | 'collections'
  | 'collection_items'
  | 'sources'
  | 'source_occurrences'
  | 'user_card_states'
  | 'review_events'
  | 'app_settings';

export interface PendingSyncMutation {
  id: string;
  ownerKey: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  entityVersion: number;
  payload: Record<string, unknown>;
  createdAt: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export interface RemoteSyncEntity {
  entityType: SyncEntityType;
  entityId: string;
  entityVersion: number;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  cursor: number;
}

export type PushMutationResult =
  | { status: 'APPLIED'; serverVersion: number }
  | { status: 'DUPLICATE'; serverVersion: number }
  | { status: 'CONFLICT'; remote: RemoteSyncEntity }
  | { status: 'REJECTED'; code: string; message: string };

export interface PullSyncPage {
  changes: RemoteSyncEntity[];
  nextCursor: number;
  hasMore: boolean;
}

export interface SyncTransport {
  pushMutation(ownerKey: string, clientId: string, mutation: PendingSyncMutation): Promise<PushMutationResult>;
  pullChanges(ownerKey: string, clientId: string, afterCursor: number, limit: number): Promise<PullSyncPage>;
}

export type SyncPhase = 'IDLE' | 'SYNCING' | 'OFFLINE' | 'ERROR';

export interface SyncSnapshot {
  phase: SyncPhase;
  pendingCount: number;
  blockedCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface SyncRunSummary {
  pushed: number;
  pulled: number;
  deferred: number;
  blocked: number;
  cursor: number;
}
