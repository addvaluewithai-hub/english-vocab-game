# Neon Cloud Architecture

## Boundary

The mobile app remains SQLite-first. Cloud features use Neon Postgres behind a JWT-authenticated HTTP/server boundary. The Expo bundle may contain public Auth/Data API URLs, but never a Postgres connection string, Neon API key, owner role credential, or RLS-bypass secret.

## Authentication

Neon Auth is the preferred identity provider. Guest study remains available without an account. A successful account adoption claims the intended local guest language pairs exactly once; signing out changes the active local owner and does not erase either local or cloud learning data.

The development Auth service is provisioned on the isolated Neon `tasks-11-20` branch. Production Auth/Data API endpoints are provisioned deliberately at the cloud release gate rather than hard-coded into source.

## Database

Version-controlled SQL lives under `db/migrations/`. The cloud model preserves `LanguagePair → Term → Sense → Card`, collections, source occurrences, user card state, and append-only review events. User-owned rows have an authenticated `owner_id`; composite owner/entity foreign keys prevent cross-tenant relationships even if a client submits inconsistent IDs.

RLS is enabled and forced on private cloud tables. `ReviewEvent` has SELECT/INSERT access only for the authenticated owner and no application UPDATE/DELETE grant.

## Synchronization

`sync_changes` provides a monotonically increasing per-owner change stream. Clients push mutations using a base version and pull changes after their durable cursor. See `docs/sync-protocol.md` for the full contract. The actual network/background engine is T021.

## Files and media

PDFs, images, audio and future generated media do not belong as large binary objects inside Postgres. Postgres stores durable metadata/object keys and provenance. Prefer Neon Object Storage when its production capabilities fit the import requirements; otherwise use an S3-compatible object store behind the same authenticated server boundary. Cached local media is disposable and may be re-downloaded.

## Migration workflow

Risky cloud schema work is first applied to a Neon child branch. Automated/explicit checks verify schema, ownership rules and representative queries. Production receives only version-controlled, reviewed migrations after the application branch is green. Dashboard-only schema edits are not the source of truth.
