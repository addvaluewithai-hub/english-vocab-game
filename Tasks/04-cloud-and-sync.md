# Phase 04 — Cloud, Authentication, and Offline Sync

Goal: keep the study experience local-first while adding secure accounts, cloud backup, and reliable multi-device synchronization on Neon.

---

## T018 — Neon cloud schema, migrations, access control, and storage strategy

**Priority:** P0  
**Dependencies:** T004

### Scope
- Translate the approved local domain into a Neon Postgres cloud schema without collapsing Term/Sense/Card boundaries.
- Define stable IDs, ownership fields, timestamps, versions, and deletion/tombstone semantics needed for sync.
- Create version-controlled migration files rather than dashboard-only schema changes; test risky schema changes on Neon branches before production.
- Define the object/file storage strategy for future user media and imported documents, using Neon Object Storage when it fits the implementation requirements or a compatible dedicated object store when it does not.
- Define secure client access: never ship a privileged Postgres connection string in the Expo app; use Neon Auth plus an authenticated server/Data API boundary.
- Implement and verify row-level/user ownership protections for private learning data where the selected Neon access path supports them.

### Acceptance criteria
- Cloud schema can be reproduced from migrations on a fresh Neon branch/project.
- Private user-owned records have verified access controls under the chosen authenticated data-access path.
- A user cannot read/write another user's private cards, reviews, sources, or media metadata.
- Local and cloud entity identifiers/version fields support deterministic synchronization.
- Mobile code contains no privileged database credentials.

---

## T019 — Neon Auth and guest-to-account migration

**Priority:** P1  
**Dependencies:** T017, T018

### Scope
- Add a minimal authentication flow using Neon Auth unless implementation evidence justifies a different compatible provider.
- Keep local guest usage possible until an account is necessary for cloud features.
- Define and implement guest-data claiming/migration when a user signs in or creates an account.
- Handle sign-out without silently deleting local learning data.
- Handle expired sessions and auth restoration without blocking local study.

### Acceptance criteria
- A new user can use the local product before account creation.
- Creating/signing into an account safely associates intended local data exactly once.
- Auth/network failure does not make already-synced local study unusable.
- Sign-out/login transitions do not leak data between accounts on a shared device.

---

## T020 — Offline sync protocol: outbox, versions, tombstones, and sync contract

**Priority:** P0  
**Dependencies:** T004, T018

### Scope
- Document the synchronization contract before coding the engine.
- Define locally generated IDs, entity versions/update timestamps, dirty state, outbox operations, server cursors/checkpoints, and tombstones.
- Define append-only ReviewEvent synchronization and idempotency guarantees.
- Define which conflicts can be last-write-wins and which require domain-aware merge behavior.
- Define failure/retry/backoff behavior and what the UI may assume during offline work.

### Acceptance criteria
- The protocol handles create/update/delete, repeated delivery, partial failure, and two-device edits on paper/tests.
- Re-sending the same review event cannot create duplicate learning history.
- Deleted entities cannot unexpectedly reappear because of an old offline client.
- The protocol is documented independently of UI implementation.

---

## T021 — Offline-first sync engine implementation

**Priority:** P0  
**Dependencies:** T020

### Scope
- Implement local outbox writes and background/foreground synchronization against the authenticated Neon cloud boundary.
- Push local mutations idempotently and pull remote changes from a checkpoint/cursor.
- Keep SQLite as the immediate UI/read source so study interactions never wait on the network.
- Sync review events, vocabulary content, collections, settings, and source metadata covered by the cloud schema.
- Use centralized fetch/data-layer patterns and centralized network/auth error handling.

### Acceptance criteria
- User can make changes offline, restart the app, reconnect, and sync without data loss.
- Sync can be interrupted and retried safely.
- Swipe/reveal latency is independent of network state.
- Automated integration tests cover at least offline create, offline edit, review-event sync, and reconnect behavior.

---

## T022 — Conflict handling, retry/recovery, and sync-status UX

**Priority:** P0  
**Dependencies:** T021

### Scope
- Implement the conflict rules designed in T020.
- Add retry with bounded backoff and distinguish transient failures from permanent validation/auth failures.
- Provide lightweight sync-state UI: synced, syncing, offline/pending, and actionable failure.
- Build a recovery path for a poisoned outbox item rather than retrying forever.
- Add diagnostics sufficient to debug a user's sync issue without exposing sensitive content unnecessarily.

### Acceptance criteria
- Simulated two-device edits resolve according to documented rules.
- One bad mutation does not block all later sync forever.
- Users can continue studying during sync errors.
- The app can surface unresolved/actionable sync failures without alarming users during ordinary offline use.

---

## T023 — Backup/restore and multi-device verification

**Priority:** P1  
**Dependencies:** T019, T022

### Scope
- Verify clean-device login restores the user's supported Neon cloud data into a fresh local database.
- Verify a second device can study and later converge with the first without duplicated reviews.
- Add a deliberate local reset/re-download recovery path for corrupted or unrecoverable local state.
- Verify media/source metadata handling under restore, including absent optional cached files.
- Document unsupported edge cases before beta.

### Acceptance criteria
- A fresh installation can reconstruct the user's bank, collections, states, and review history from cloud data.
- Two devices converge after independent offline use under tested scenarios.
- Recovery tools cannot accidentally delete cloud data without explicit destructive intent.
- Gate C has a repeatable manual verification checklist.
