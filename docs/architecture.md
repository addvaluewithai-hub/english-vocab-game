# Architecture Decisions

## ADR-001 — Mobile stack
Use Expo SDK 57, React Native, TypeScript and Expo Router. Routes stay thin inside `app/`; reusable UI, domain logic, storage and services live under `src/`.

## ADR-002 — Offline-first local state
Expo SQLite is the local source used by the study loop. The app must remain fully usable for local study without a network connection.

## ADR-003 — Cloud direction
Use Neon Postgres for future cloud persistence. Neon replaces the earlier Supabase assumption. Cloud synchronization is intentionally deferred beyond the first ten tasks.

Future authentication should prefer Neon Auth (Better Auth compatible) unless implementation evidence gives us a reason to choose a separate auth provider.

## ADR-004 — Domain boundaries
The learning model separates `Term`, `Sense`, `Card`, `UserCardState`, and append-only `ReviewEvent` records. UI code does not own scheduling or SQL.

## ADR-005 — Scheduling
All next-review decisions pass through a `ReviewScheduler` interface. The first implementation is deliberately simple and deterministic; a later task may replace it with FSRS without changing screen code.

## ADR-006 — Session behavior
A study session owns an in-memory stable queue created from SQLite. Forgotten cards are reinserted once near the end of the same session. A retry does not recursively create another same-session retry, preventing endless loops.

## ADR-007 — Sync-ready identifiers
Local records use text IDs generated in the application and include timestamps. Mutable syncable entities include a version counter and optional deletion timestamp. Review events remain append-only and immutable through normal repository APIs.

## Folder structure
- `app/` — Expo Router route files only.
- `src/components/` — reusable UI primitives.
- `src/features/` — feature-specific screens and components.
- `src/domain/` — entities and scheduler contracts.
- `src/data/` — SQLite bootstrap, migrations, seed data and repositories.
- `src/services/` — study-session orchestration and other application services.
- `src/theme/` — visual and motion tokens.
- `src/utils/` — small shared utilities.

## Migration strategy
SQLite schema changes are versioned with `PRAGMA user_version`. Migrations run sequentially in a transaction at startup. Production migrations must be forward-only; destructive reshaping should copy into a new table rather than assuming an empty local database.
