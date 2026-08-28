# Phase 06 — Smart Imports and AI Enrichment

Goal: turn material the learner already consumes into curated, contextual vocabulary without dumping noisy AI output into the bank.

---

## T030 — Import job architecture and ingestion pipeline framework

**Priority:** P1  
**Dependencies:** T016, T018, T021

### Scope
- Define a source-agnostic import job lifecycle: queued, processing, needs-review, completed, failed/cancelled.
- Keep long-running extraction/enrichment server-side; the mobile app submits jobs, observes status, and reviews results.
- Define normalized candidate output containing term/phrase, proposed sense, translation/definition, context, source occurrence, confidence/usefulness, and duplicate hints.
- Add idempotency so retrying the same job/result does not create duplicate canonical vocabulary.
- Define storage/cleanup rules for uploaded source files and temporary artifacts.

### Acceptance criteria
- One pipeline contract can serve text, PDF, YouTube, URL, and image sources.
- Mobile can leave/reopen while a job is processing without losing it.
- Failed jobs expose a safe retry path and understandable error category.
- Candidates cannot enter the canonical bank without passing the staging/approval flow unless a future explicit setting changes that policy.

---

## T031 — Paste/text/list import with normalization, dedupe, and enrichment

**Priority:** P1  
**Dependencies:** T030

### Scope
- Support pasted prose and simple word/phrase lists as the first real import source.
- Detect candidate target-language vocabulary, normalize casing/spacing, and preserve phrases where appropriate.
- Match against existing Term/Sense data and flag exact/likely duplicates.
- Propose sense, concise translation/definition, and a useful context sentence when source text provides one.
- Send results through generic import staging.
- Route prose enrichment through the server-side Gemma/Gemini quota-resilient model chain; explicit vocabulary lists remain deterministic/local and require no model call.

### Acceptance criteria
- A pasted paragraph produces a manageable candidate list rather than every token.
- A pasted vocabulary list imports efficiently without requiring prose extraction.
- Existing senses are reused/linked when appropriate; same-spelling different-sense candidates are not blindly merged.
- User corrections in staging are preserved in the final created records.
- Rate limits/transient model failures can fall through to another compatible model without exposing the API key to the mobile client.

---

## T032 — PDF import with extraction, page provenance, and context capture

**Priority:** P1  
**Dependencies:** T030

### Scope
- Add PDF upload/selection and server-side analysis.
- Upload directly from mobile to short-lived private object storage rather than loading/piping the entire PDF through the API route.
- Preserve page number and nearby sentence/paragraph provenance for proposed vocabulary when confidently verifiable.
- Handle text PDFs first; detect unsupported/scanned/encrypted cases explicitly rather than pretending extraction succeeded.
- Bound document/file size and candidate count, consolidate repeated vocabulary, and feed results through common staging rather than auto-adding them.
- Use Gemini URL Context through the multimodal fallback chain so PDF imports share the same server secret/provider strategy as the other MVP AI imports.

### Acceptance criteria
- Supported PDFs produce candidates with page provenance on representative documents; uncertain page locations remain null rather than fabricated.
- Large supported PDFs do not require loading the entire document into mobile JavaScript memory.
- Repeated vocabulary is consolidated while retaining the best representative source occurrence for the MVP; the canonical SourceOccurrence model remains capable of multiple occurrences in a later enrichment pass.
- Unsupported PDFs fail with actionable messaging and do not create partial junk records silently.

**MVP scope decision:** retaining every useful duplicate occurrence across many pages is deferred. One representative occurrence per proposed candidate is sufficient for Gate E and avoids expanding the import-job contract before usage validates the need.

---

## T033 — YouTube import with timestamped spoken-context provenance

**Priority:** P1  
**Dependencies:** T030

### Scope
- Accept common YouTube URL forms and canonicalize them to one video ID/source fingerprint.
- Use a compliant server-side Gemini public-video understanding integration rather than client-side transcript scraping.
- Preserve a timestamped spoken-context occurrence for vocabulary candidates when confidently available.
- Bound and dedupe long-video candidate output, retaining the best/representative occurrence for each proposed sense.
- Handle private, unavailable, unsupported, or provider-rejected videos cleanly.
- Allow a source occurrence to deep-link back to the canonical video timestamp where platform behavior permits.

### Acceptance criteria
- A supported public video produces staged vocabulary tied to spoken/video context and timestamp.
- Unsupported/private/unavailable cases are explicit failures, not empty-success imports.
- Re-running equivalent watch/short/live/share URLs for the same video is idempotent at the source/job layer.
- The importer respects provider/API terms and does not depend on brittle client-side scraping.
- A transient 429/5xx/network failure can fall through to another compatible Flash-Lite model.

---

## T034 — Web article/URL import with clean-text extraction and provenance

**Priority:** P2  
**Dependencies:** T030

### Scope
- Accept a webpage/article URL and perform server-side clean-text extraction for supported public pages.
- Preserve canonical URL/title and useful paragraph-level context.
- Reject or clearly flag paywalled, login-required, unsupported, or extraction-poor pages.
- Reuse the common vocabulary candidate, dedupe, ranking, and staging pipeline.

### Acceptance criteria
- Representative article pages yield clean candidate context without navigation/footer noise dominating results.
- Source metadata links back to the original page.
- Unsupported/private pages fail clearly and safely.
- URL re-import does not create uncontrolled duplicate source records.

---

## T035 — Photo/image vocabulary import with OCR workflow and review staging

**Priority:** P2  
**Dependencies:** T030

### Scope
- Add image/camera/file input for vocabulary discovery from books, signs, screenshots, menus, or notes.
- Run OCR through an appropriate native/service path and preserve the original image/source reference where permitted.
- Present recognized text/candidates for review because OCR confidence can be poor.
- Handle orientation, multiple text blocks, mixed languages, and low-confidence results gracefully.
- Avoid creating vocabulary from low-confidence OCR without user review.

### Acceptance criteria
- Clear printed text produces editable staged candidates on representative images.
- Low-confidence/failed OCR is visibly distinguished from reliable extraction.
- The original image is not retained indefinitely unless required/consented to by the product policy.
- OCR output passes through the same dedupe/sense model as all other imports.

---

## T036 — AI usefulness/level filtering, sense selection, and import approval ranking

**Priority:** P1  
**Dependencies:** T031, T032, T033

### Scope
- Rank candidate vocabulary by likely usefulness for the learner's active language level and context.
- Filter obvious stopwords/already-known noise while avoiding overconfident deletion of useful phrases.
- Select/propose the sense actually used in the source context rather than a generic first dictionary meaning.
- Prefer a bounded recommended set and allow the user to expand to additional candidates.
- Explain low-confidence/ambiguous sense cases in staging instead of inventing certainty.

### Acceptance criteria
- A long source does not default to hundreds of uncurated additions.
- Ranking demonstrably favors context-relevant, level-appropriate vocabulary on a test corpus.
- Ambiguous words can produce distinct proposed senses when contexts differ.
- Existing strong/mastered vocabulary can be deprioritized without erasing new source occurrences.

---

## T037 — Optional media/image enrichment generation, caching, and storage controls

**Priority:** P2  
**Dependencies:** T029, T030

### Scope
- Generate/fetch optional visual enrichment only when adaptive rules say it is useful.
- Store provenance and generation metadata so media can be regenerated, replaced, or removed.
- Create client caching and server storage policies with size limits and cleanup behavior.
- Avoid visual enrichment for concepts where an image is likely misleading; prefer context/explanation instead.
- Provide user controls to replace/remove unsuitable media.

### Acceptance criteria
- Enrichment never blocks importing or studying a vocabulary item.
- Concrete test vocabulary can receive useful cached visual support; abstract examples are not forced into misleading imagery.
- Media storage has quotas/cleanup behavior and does not grow unbounded.
- User-authored media/notes are never overwritten silently by generated content.

**Deferred decision:** this is intentionally post-MVP. Pronunciation/audio and the adaptive enrichment rules already provide useful learning support; generated imagery adds storage/provider/UI complexity without being required to validate the daily study/import loop. Revisit after beta usage shows demand.

---

## T038 — Import failures, limits, cost controls, observability, and retry UX

**Priority:** P1  
**Dependencies:** T030, T031, T032, T033

### Scope
- Define per-source size/duration limits and validation before expensive processing starts.
- Track job duration/state, extraction counts, AI usage/cost-relevant metrics, failure categories, model fallbacks, and retries without logging sensitive source contents by default.
- Add cancellation and bounded retry behavior for expensive jobs.
- Prevent accidental duplicate submissions and runaway batch processing.
- Add user-facing messages for limit exceeded, unsupported source, provider unavailable, extraction failed, and AI enrichment failed/partial success.

### Acceptance criteria
- Import jobs cannot retry indefinitely or generate uncontrolled duplicate AI work.
- Product can distinguish extraction failure from enrichment failure and preserve useful partial work where safe.
- Operational metrics make unexpectedly expensive/noisy import behavior and repeated model fallback discoverable.
- User can recover from common failures without losing the original approved/staged work.
