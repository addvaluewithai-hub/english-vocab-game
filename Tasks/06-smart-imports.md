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

### Acceptance criteria
- A pasted paragraph produces a manageable candidate list rather than every token.
- A pasted vocabulary list imports efficiently without requiring prose extraction.
- Existing senses are reused/linked when appropriate; same-spelling different-sense candidates are not blindly merged.
- User corrections in staging are preserved in the final created records.

---

## T032 — PDF import with extraction, page provenance, and context capture

**Priority:** P1  
**Dependencies:** T030

### Scope
- Add PDF upload/selection and server-side text extraction.
- Preserve page number and nearby sentence/paragraph provenance for proposed vocabulary.
- Handle text PDFs first; detect unsupported/scanned/encrypted cases explicitly rather than pretending extraction succeeded.
- Chunk large documents safely and combine/dedupe candidate vocabulary across chunks.
- Feed candidates through common ranking/staging rather than auto-adding them.

### Acceptance criteria
- Supported PDFs produce candidates with correct page provenance on representative documents.
- Large PDFs do not require loading the entire document into the mobile app memory.
- Repeated vocabulary across pages is consolidated while retaining multiple useful source occurrences.
- Unsupported PDFs fail with actionable messaging and do not create partial junk records silently.

---

## T033 — YouTube import with transcript extraction and timestamp provenance

**Priority:** P1  
**Dependencies:** T030

### Scope
- Accept a YouTube URL and resolve a supported transcript/caption source through a compliant server-side integration.
- Preserve timestamped transcript context for vocabulary candidates.
- Chunk long transcripts, dedupe repeated candidates, and retain the best/representative occurrences.
- Handle videos with unavailable captions/transcripts or unsupported access cleanly.
- Allow a source occurrence to deep-link back to the relevant video timestamp where platform behavior permits.

### Acceptance criteria
- A supported video produces staged vocabulary tied to transcript context and timestamp.
- Missing transcript/caption cases are explicit failures, not empty-success imports.
- Re-running the same video import is idempotent at the source/job layer.
- The importer respects provider/API terms and does not depend on brittle client-side scraping.

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

---

## T038 — Import failures, limits, cost controls, observability, and retry UX

**Priority:** P1  
**Dependencies:** T030, T031, T032, T033

### Scope
- Define per-source size/duration limits and validation before expensive processing starts.
- Track job duration/state, extraction counts, AI usage/cost-relevant metrics, failure categories, and retries without logging sensitive source contents by default.
- Add cancellation and bounded retry behavior for expensive jobs.
- Prevent accidental duplicate submissions and runaway batch processing.
- Add user-facing messages for limit exceeded, unsupported source, provider unavailable, extraction failed, and AI enrichment failed/partial success.

### Acceptance criteria
- Import jobs cannot retry indefinitely or generate uncontrolled duplicate AI work.
- Product can distinguish extraction failure from enrichment failure and preserve useful partial work where safe.
- Operational metrics make unexpectedly expensive/noisy import behavior discoverable.
- User can recover from common failures without losing the original approved/staged work.
