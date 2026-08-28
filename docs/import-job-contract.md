# Smart Import Job Contract

This contract is the shared boundary for text, PDF, YouTube, URL, and photo imports. Source-specific extraction is implemented by later tasks; the lifecycle and candidate shape stay stable.

## Lifecycle

`QUEUED → PROCESSING → NEEDS_REVIEW → COMPLETED`

A job may move to `FAILED` or `CANCELLED`. Retrying a failed/cancelled job reuses the same source fingerprint and idempotency key rather than creating a second logical job.

The mobile app persists a local mirror of every job so closing or restarting the app does not lose progress. Long-running extraction, OCR, transcript retrieval, parsing, and AI enrichment run on the authenticated server side. The Expo client never receives privileged database credentials.

## Submission

`POST /v1/import-jobs`

The client sends an authenticated request with an `Idempotency-Key` derived from the language pair, source type, and normalized source fingerprint. Repeated submission of the same logical source must return or continue the existing job.

Supported source types are `TEXT`, `PDF`, `YOUTUBE`, `URL`, and `PHOTO`.

## Normalized candidate

Every source adapter emits the same candidate shape:

```ts
interface NormalizedImportCandidate {
  candidateKey: string;
  term: string;
  translation: string;
  definition: string | null;
  partOfSpeech: string | null;
  context: string | null;
  occurrence: {
    sentence: string | null;
    sourceUri: string | null;
    locator: string | null;
    pageNumber: number | null;
    timestampSeconds: number | null;
  };
  confidence: number | null;
  usefulness: number | null;
  duplicateHint: 'NONE' | 'EXACT' | 'LIKELY' | null;
  isVisuallyConcrete: boolean | null;
}
```

Candidate keys are stable within a logical job. Source occurrence metadata is retained even when the first staging UI only needs term/meaning/context, so PDF pages, YouTube timestamps, URL locators, and photo provenance can be attached by their source adapters without changing this contract.

## Approval boundary

`NEEDS_REVIEW` candidates are copied into the existing generic Import Staging flow. They cannot enter canonical `Term → Sense → Card` records directly. User edits made in staging are authoritative for the final canonical records.

No future importer may bypass staging unless the product introduces an explicit user-controlled auto-approve setting and documents that decision separately.

## Failures and retry

Errors are categorized safely for users and diagnostics. Raw source text should not be included in telemetry by default. Network/server failures can be retried; unsupported/encrypted/unavailable-source failures should require a user action rather than retry forever.

A failed job does not create partial canonical vocabulary. A retry reuses the same idempotency key and stable candidate keys.

## Temporary artifacts

Uploaded or extracted temporary files are server-owned and have an expiry timestamp. A cleanup worker may delete expired temporary artifacts after the job no longer needs them. Canonical vocabulary and approved source metadata are separate from temporary extraction artifacts and are not removed by this cleanup.
