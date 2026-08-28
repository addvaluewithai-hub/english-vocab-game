import { describe, expect, it } from 'vitest';
import { isReviewEventIdempotent, mutationKey, resolveMutableConflict, retryDelayMs, shouldRetrySyncFailure } from '@/sync/protocol';

const base = {
  entityId: 'sense-1',
  version: 4,
  updatedAt: '2026-08-28T10:00:00.000Z',
  deletedAt: null,
  clientId: 'device-a',
};

describe('sync protocol', () => {
  it('creates a stable mutation idempotency key', () => {
    expect(mutationKey('senses', 'sense-1', 5, 'UPSERT')).toBe('senses:sense-1:5:UPSERT');
  });

  it('never lets a stale edit resurrect a newer tombstone', () => {
    const local = { ...base, version: 4, updatedAt: '2026-08-28T12:00:00.000Z' };
    const remote = { ...base, version: 5, deletedAt: '2026-08-28T11:00:00.000Z', updatedAt: '2026-08-28T11:00:00.000Z', clientId: 'device-b' };
    expect(resolveMutableConflict(local, remote)).toBe('REMOTE');
  });

  it('resolves concurrent descriptive edits deterministically', () => {
    const local = { ...base, updatedAt: '2026-08-28T12:00:00.000Z', clientId: 'device-a' };
    const remote = { ...base, updatedAt: '2026-08-28T12:00:00.000Z', clientId: 'device-z' };
    expect(resolveMutableConflict(local, remote)).toBe('REMOTE');
    expect(resolveMutableConflict(remote, local)).toBe('LOCAL');
  });

  it('treats identical repeated review delivery as success but rejects mutated history', () => {
    const payload = JSON.stringify({ id: 'review-1', grade: 'KNEW', reviewedAt: '2026-08-28T10:00:00Z' });
    expect(isReviewEventIdempotent(null, payload)).toBe('INSERT');
    expect(isReviewEventIdempotent(payload, payload)).toBe('DUPLICATE');
    expect(isReviewEventIdempotent(payload, payload.replace('KNEW', 'FORGOT'))).toBe('INTEGRITY_ERROR');
  });

  it('retries network, throttling and server failures but not validation/auth failures', () => {
    expect(shouldRetrySyncFailure(null)).toBe(true);
    expect(shouldRetrySyncFailure(429)).toBe(true);
    expect(shouldRetrySyncFailure(503)).toBe(true);
    expect(shouldRetrySyncFailure(400)).toBe(false);
    expect(shouldRetrySyncFailure(401)).toBe(false);
  });

  it('uses bounded exponential backoff', () => {
    expect(retryDelayMs(0, 0.5)).toBe(1000);
    expect(retryDelayMs(2, 0.5)).toBe(4000);
    expect(retryDelayMs(99, 0.5)).toBe(60000);
  });
});
