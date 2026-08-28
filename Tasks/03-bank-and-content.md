# Phase 03 — Vocabulary Bank and Content

Goal: turn the prototype into a useful local vocabulary product where users can add, organize, inspect, and study their own vocabulary.

---

## T012 — Vocabulary bank browse, search, filter, and state grouping

**Priority:** P0  
**Dependencies:** T003, T004

### Scope
- Build the vocabulary bank screen backed by local repositories.
- Support search across term/phrase, translation/meaning, and relevant context.
- Support useful state filters such as All, Learning/Due, and Strong/Mastered without exposing raw scheduler complexity.
- Show compact metadata such as collection/source or next review only where it helps.
- Handle large local banks with list virtualization and stable keys.

### Acceptance criteria
- Users can find a known item quickly by term or meaning.
- Filtering does not mutate learning state.
- Empty filter/search states are understandable and recoverable.
- Scrolling remains responsive on a realistically large seeded bank.

---

## T013 — Manual term/sense/context create and edit flow

**Priority:** P0  
**Dependencies:** T004, T012

### Scope
- Add manual creation/editing for term or phrase, target language, one or more senses, translation/definition, and context sentence.
- Support optional notes, part of speech, pronunciation text, and example translation without making the basic form heavy.
- Detect likely duplicates before creating a second canonical term/sense.
- Allow editing content without deleting or rewriting historical ReviewEvents.
- Define safe behavior when a learned card's sense is materially changed.

### Acceptance criteria
- A user can add a minimal vocabulary item in a short flow and study it afterward.
- The model supports two different senses of the same surface term.
- Editing content preserves review history and source provenance.
- Validation prevents unusable records while optional fields remain optional.

---

## T014 — Collections and source provenance model/UI

**Priority:** P1  
**Dependencies:** T004, T013

### Scope
- Build collection creation/rename/archive flows.
- Allow vocabulary to belong to multiple collections without duplicating the canonical sense/card.
- Represent source types such as manual, text, PDF, YouTube, URL, and image even before all importers exist.
- Show original context plus page/timestamp/URL-style source metadata when present.
- Establish a clear distinction between Collection membership and Source provenance.

### Acceptance criteria
- The same card can appear in multiple collections with one learning state.
- Source occurrence data can represent repeated encounters with the same sense.
- Manual vocabulary works cleanly without any source metadata.
- Collections can be archived without deleting vocabulary or review history.

---

## T015 — Vocabulary detail, review history, and source-context screen

**Priority:** P1  
**Dependencies:** T009, T012, T014

### Scope
- Build a detail screen for the term/phrase, selected sense, contexts, notes, source occurrences, and collections.
- Show a human-readable review history/learning summary rather than raw database fields.
- Provide edit, archive/remove-from-collection, and study-now actions where appropriate.
- Surface original source location such as page/timestamp when available.

### Acceptance criteria
- A user can understand why a vocabulary item is in the bank and where it came from.
- Review history reflects persisted events accurately.
- Removing a collection relationship does not delete the canonical vocabulary or history.
- Destructive actions are clearly distinguished from reversible organization actions.

---

## T016 — Import staging and review-before-add UX

**Priority:** P1  
**Dependencies:** T012, T014

### Scope
- Build a generic staging screen for proposed vocabulary before it enters the main bank.
- Support select/deselect, edit sense/translation/context, duplicate warnings, and bulk approve/reject.
- Show import provenance and confidence/usefulness metadata without making AI output look authoritative.
- Make this UI source-agnostic so text, PDF, YouTube, URL, and image imports can all feed it.

### Acceptance criteria
- No smart importer is required to bypass user approval by default.
- Candidate items can be corrected before creation.
- Duplicate/same-term-different-sense cases are understandable.
- Approved candidates create canonical vocabulary plus source/collection relationships consistently.

---

## T017 — Language-pair onboarding and app settings

**Priority:** P1  
**Dependencies:** T002, T004

### Scope
- Add a lightweight first-run flow for learning language and explanation/native language.
- Support changing active language pair without mixing unrelated banks or review queues.
- Add settings for review behavior that already exists, accessibility/motion preferences where app-specific, and later notification hooks.
- Keep architecture open to multiple language pairs per user.

### Acceptance criteria
- First launch reaches a usable study/add flow with a defined language pair.
- Switching language pairs does not leak cards from another pair into the study queue.
- Existing data remains associated with the correct pair after settings changes.
- Settings have safe defaults and survive restart.
