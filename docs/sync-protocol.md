# Offline Sync Protocol — v1

This document is the contract for T020. T021 implements the engine against this contract.

## Invariants

1. SQLite is always the immediate read/write source for the mobile UI. Reveal, swipe, adding a term, and browsing never wait for the network.
2. IDs are generated on the client and are globally unique strings. The same ID is used locally and in Neon.
3. User-owned cloud rows always carry `owner_id`; the authenticated boundary derives that owner from the verified Neon Auth JWT and never trusts an arbitrary owner from a different user.
4. Mutable entities carry `version`, `updated_at`, and `deleted_at`. Deletion is a tombstone during the supported sync-retention window.
5. `ReviewEvent` is immutable and append-only. Its ID is the idempotency key.
6. Delivery is at-least-once. Every push and pull operation must therefore be safe to repeat.

## Local outbox

A local mutation creates/updates SQLite first, then records an outbox item in the same logical operation. Outbox items contain:

- stable mutation ID;
- entity type and entity ID;
- operation: `UPSERT`, `DELETE`, or `APPEND`;
- the local candidate version;
- payload including the last server/base version known when the edit was made;
- creation time, attempt count, next retry time, and last machine-readable error code.

T021 may compact unsent mutable UPSERTs for the same entity, but it must never compact distinct `ReviewEvent` APPEND operations.

## Push contract

For a mutable entity, the client sends `{entityId, mutationId, baseVersion, payload, deletedAt}`. The cloud boundary:

1. verifies authentication and forces `owner_id` to the authenticated user;
2. inserts a new row when none exists and the mutation is a valid create;
3. updates only when the stored version matches `baseVersion`;
4. increments the server version on accepted mutation;
5. writes a change-log row in the same transaction;
6. returns the accepted canonical row/version.

If the stored version differs, the server returns a conflict carrying the current canonical row. The client does not blindly retry the stale write.

For `ReviewEvent`, insert uses the event ID as an idempotency key. Re-sending an existing ID with identical immutable content is success. Re-sending the same ID with different content is a permanent integrity error.

## Pull contract

Each accepted cloud mutation creates a monotonically increasing `sync_changes.cursor`. A device stores its last successfully applied cursor in `sync_meta`.

Pull asks for changes `cursor > checkpoint` for the authenticated user, ordered ascending. The server may paginate, but a page is applied atomically locally before the checkpoint advances. Re-downloading an already-applied page is safe because entity IDs/versions and review-event IDs are idempotent.

## Deletes and tombstones

Delete is an update setting `deleted_at` and incrementing version. Tombstones participate in the change log and sync exactly like other mutations. An old offline client cannot resurrect a tombstoned row with a stale `baseVersion`; it receives a conflict instead.

Hard deletion is a later maintenance concern and may only occur after a documented retention window in which all supported clients have had a chance to observe the tombstone.

## Conflict policy

- `ReviewEvent`: no merge; immutable append by ID.
- `UserCardState`: review events are the durable truth. Concurrent state conflicts prefer the state recomputed from the union of review events; until the FSRS engine owns that recomputation, server state wins and the client reapplies newly unsynced local review events.
- Term/sense/source descriptive content: deterministic last-edit-wins by `(updatedAt, clientId)` after both versions are preserved for diagnostics. T022 may surface a manual recovery option for meaningful sense edits.
- Collection membership and settings: deterministic last-edit-wins, including tombstones.
- A delete beats a stale edit because the stale edit's `baseVersion` cannot match the tombstone version.

## Retry and failure behavior

Transient network/5xx/429 failures use bounded exponential backoff with jitter, capped at a reasonable mobile interval. Auth failures pause cloud sync until auth is restored. Validation/integrity failures poison only the affected outbox item; later independent items are not permanently blocked. T022 implements the user-visible recovery surface.

## Guest and account claiming

Guest data is local-only. On first successful account adoption, guest language pairs are atomically reassigned to that authenticated owner locally and later pushed by T021. The device records the claim so the same guest dataset cannot be silently claimed twice by two accounts. Signing out changes the active local owner; it does not erase the claimed account's local data.

## Security boundary

The Expo app contains only public Auth/Data API endpoints. Privileged Neon connection strings, Neon API keys, and owner/bypass-RLS credentials never ship in the mobile bundle. Cloud mutations are accepted only through the JWT-authenticated Data API or an equivalent authenticated server boundary that enforces the same RLS/ownership rules.
