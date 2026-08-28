export type SyncOperation = 'UPSERT' | 'DELETE' | 'APPEND';

export interface MutableSyncVersion {
  entityId: string;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
  clientId: string;
}

export interface OutboxEnvelope<T> {
  mutationId: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  baseVersion: number;
  candidateVersion: number;
  payload: T;
}

export type ConflictDecision = 'LOCAL' | 'REMOTE';

export function mutationKey(entityType: string, entityId: string, version: number, operation: SyncOperation): string {
  return `${entityType}:${entityId}:${version}:${operation}`;
}

export function compareEdits(a: Pick<MutableSyncVersion, 'updatedAt' | 'clientId'>, b: Pick<MutableSyncVersion, 'updatedAt' | 'clientId'>): number {
  const time = a.updatedAt.localeCompare(b.updatedAt);
  if (time !== 0) return time;
  return a.clientId.localeCompare(b.clientId);
}

export function resolveMutableConflict(local: MutableSyncVersion, remote: MutableSyncVersion): ConflictDecision {
  if (remote.version > local.version && remote.deletedAt) return 'REMOTE';
  if (local.version > remote.version && local.deletedAt) return 'LOCAL';
  return compareEdits(local, remote) > 0 ? 'LOCAL' : 'REMOTE';
}

export function shouldRetrySyncFailure(status: number | null): boolean {
  if (status === null) return true;
  if (status === 408 || status === 425 || status === 429) return true;
  return status >= 500 && status <= 599;
}

export function retryDelayMs(attempt: number, random01 = 0.5): number {
  const safeAttempt = Math.max(0, Math.min(attempt, 8));
  const base = Math.min(60_000, 1_000 * 2 ** safeAttempt);
  const jitter = Math.max(0, Math.min(1, random01));
  return Math.round(base * (0.75 + jitter * 0.5));
}

export function isReviewEventIdempotent(existingJson: string | null, incomingJson: string): 'INSERT' | 'DUPLICATE' | 'INTEGRITY_ERROR' {
  if (existingJson === null) return 'INSERT';
  return existingJson === incomingJson ? 'DUPLICATE' : 'INTEGRITY_ERROR';
}
