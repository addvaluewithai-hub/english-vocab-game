# Smart Import Operations

This document defines the MVP operating contract for smart imports. The goal is to keep imports useful and recoverable without letting AI/provider failures block the local study product.

## Supported MVP sources

- Pasted vocabulary lists: flexible local parsing supports words, phrases, optional meanings, common separators, and simple numbered/bulleted forms. Lists whose meanings are already supplied can stay fully local; signed-in users may use AI to fill missing translation/definition/part-of-speech/level/example data before staging.
- Pasted prose: Gemini/Gemma text router, bounded to a curated candidate set.
- Text PDFs: direct-to-object-storage upload followed by server-side Gemini URL-context analysis with page provenance.
- Public YouTube videos: server-side Gemini video analysis with timestamped spoken-context provenance.

URL article and photo/OCR imports remain optional P2 work. Generated visual enrichment is explicitly post-MVP.

## Central limits

`src/imports/policy.ts` is the implementation source for import limits. At the current MVP gate:

- pasted text: 12,000 characters;
- vocabulary list: at most 60 candidates per import;
- signed-in vocabulary-list enrichment: processed in small batches of at most 30 items, with completed local work checkpointed between batches;
- AI-curated pasted prose: at most 24 candidates;
- PDF: at most 25 MiB and 40 candidates;
- YouTube: URL at most 2,048 characters and 32 candidates;
- photo upload boundary: at most 10 MiB if/when T035 is enabled;
- retries: at most 3 per logical job;
- temporary PDF artifacts: 24-hour retention target.

Both client and server validation use this policy. Expensive work must not start when a request is already known to violate a limit.

## Idempotency and duplicate work

A logical import is keyed by language pair, source type, and normalized source fingerprint. Re-submitting the same source reuses the same durable job rather than creating uncontrolled duplicate AI work.

If a job is already processing, a duplicate request returns the current job state rather than starting a second provider call. Failed or cancelled jobs must pass the bounded retry gate before the source is submitted again.

Raw pasted source text is not retained just to enable automatic retries. A retry reopens the existing logical job and asks the user to re-submit the source. This is intentionally less magical and more privacy-preserving.

## Cancellation

Cancellation is sent to the server and persisted locally. A late provider response cannot revive a cancelled job into `NEEDS_REVIEW`; late candidate writes are ignored or removed.

Provider calls that have not started yet are skipped if the job has already left the queued state. This avoids unnecessary quota consumption after cancellation or duplicate submission.

## Failure categories

The app normalizes common failures into operational categories:

- `LIMIT_EXCEEDED`
- `UNSUPPORTED_SOURCE`
- `PROVIDER_UNAVAILABLE`
- `EXTRACTION_FAILED`
- `ENRICHMENT_FAILED`
- `AUTH_REQUIRED`
- `NETWORK_OR_SERVER`

User-facing messages should explain the recovery action without exposing provider internals or credentials.

## Metrics and privacy

Import-job metrics may include:

- source type;
- input character count or byte count;
- candidate count;
- duration;
- provider/model used;
- fallback count and per-attempt HTTP/timeout outcome;
- token usage when supplied by the provider;
- retry count and failure category;
- learner CEFR level used for ranking.

Do not include raw pasted text, PDF contents, transcript/spoken text, vocabulary terms, translations, definitions, context sentences, API keys, database credentials, or presigned storage URLs in operational telemetry.

## Candidate safety boundary

Provider output is a proposal. It is normalized and validated, ranked for the learner, and then sent through import staging. No smart-import candidate enters the canonical vocabulary bank without user approval.

AI-generated study examples for a bare vocabulary list are enrichment, not source evidence: they may appear on the card but must not be stored as if they were an original SourceOccurrence sentence. Exact existing senses may be selected to preserve a real new source occurrence without creating a duplicate card. Mastered vocabulary may be deprioritized but its new source provenance is not silently erased.

## Provider outage behavior

AI outages must never block manual vocabulary creation, local vocabulary-list import when meanings are already supplied, launching the app, or studying already-local cards. The Gemini/Gemma router falls through only on retryable transient/provider failures; clear auth/validation errors stop immediately rather than burning the full model chain.
