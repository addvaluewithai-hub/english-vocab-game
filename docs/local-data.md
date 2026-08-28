# Local Data and Migration Strategy

SQLite is initialized through `SQLiteProvider` and `migrateDatabase`. Migrations are ordered, versioned, and applied transactionally. `PRAGMA user_version` is the schema version marker.

Rules:

1. Never edit an already-shipped migration; append a new migration.
2. Migration functions must be safe to run exactly once in order and the app must tolerate reopening an already-current database.
3. Foreign keys are enabled and WAL mode is requested on initialization.
4. UI components never issue SQL.
5. `review_events` is append-only through the repository API.
6. Sync-ready entities include stable string IDs, `created_at`, `updated_at`, version counters, and nullable `deleted_at` where soft deletion is meaningful.
7. Developer seed/reset helpers are gated behind `__DEV__` and never run automatically for production data.
