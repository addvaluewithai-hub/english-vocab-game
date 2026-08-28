# Phase 01 — Foundation

Goal: establish the product contract, Expo shell, UI primitives, and local data foundations without prematurely building cloud or AI features.

---

## T001 — Product contract, domain glossary, and architecture decisions

**Priority:** P0  
**Dependencies:** none  
**Outcome:** everyone builds the same product and uses the same domain language.

### Scope
- Write the concise product contract: target user, core job-to-be-done, core loop, success signal, and MVP non-goals.
- Define the domain vocabulary: Term/Phrase, Sense, Card, Review Event, User Card State, Collection, Source, Source Occurrence, Study Session.
- Lock the principle that a term can have multiple senses and that a phrase can be a learning unit.
- Record architecture decisions for Expo/React Native/TypeScript, Expo Router, local-first SQLite, Supabase cloud, and scheduler abstraction.
- Define lifecycle meanings for `NEW`, `LEARNING`, `REVIEW`, and `MASTERED` (internal state can evolve later).
- Define what data is append-only (review events) and what may be edited.

### Acceptance criteria
- Product and architecture docs exist in-repo and are understandable without chat history.
- The docs explicitly reject `word → single translation` as the canonical model.
- MVP vs post-MVP boundaries are explicit.
- No unresolved P0 product-model ambiguity remains before app scaffolding.

---

## T002 — Expo TypeScript scaffold and navigation shell

**Priority:** P0  
**Dependencies:** T001

### Scope
- Bootstrap the Expo app with TypeScript.
- Add Expo Router and a route structure that can grow into Study, Bank, Add/Edit, Stats, and Settings.
- Add path aliases and keep components/services/types outside the `app` route directory.
- Establish lint/typecheck/test scripts and basic environment configuration conventions.
- Verify the app runs in Expo Go first; configure a development-build path for production-grade native testing.
- Add a minimal root screen and navigation smoke test.

### Acceptance criteria
- App launches on supported iOS/Android development paths.
- `/` always resolves and navigation shell does not crash.
- `typecheck` and lint commands pass on a clean checkout.
- Folder structure is documented and does not mix route files with domain/service code.

---

## T003 — Design system and reusable interaction primitives

**Priority:** P0  
**Dependencies:** T002

### Scope
- Define spacing, typography, radius, surface, semantic feedback, and motion tokens.
- Build reusable Button/IconButton, Card surface, Badge/Chip, Progress indicator, Empty State, Sheet/Modal, and feedback label primitives.
- Establish accessibility defaults: touch targets, contrast, dynamic text tolerance, reduced-motion behavior.
- Establish reusable motion helpers for flip, drag, enter/exit, and success/error feedback.
- Keep the visual direction focused: one primary learning action per screen and no dashboard clutter.

### Acceptance criteria
- Study screens can be built without inventing one-off visual primitives.
- Components work across small and large phones and tolerate font scaling.
- Motion can be disabled/reduced without breaking interaction.
- Semantic success/failure states are not communicated by color alone.

---

## T004 — Local domain model, SQLite schema, migrations, and repository layer

**Priority:** P0  
**Dependencies:** T001, T002

### Scope
- Model at minimum: LanguagePair, Term, Sense, Card, Collection, CollectionItem, Source, SourceOccurrence, UserCardState, ReviewEvent.
- Represent terms and phrases independently from their senses.
- Keep source provenance capable of storing page numbers, timestamps, original sentences, and source identifiers.
- Design append-only review events and derived current learning state.
- Implement versioned SQLite migrations and repository/service boundaries; UI must not write SQL directly.
- Add timestamps/IDs/version fields needed for future sync without implementing cloud sync yet.

### Acceptance criteria
- Fresh install creates the schema reliably; migrations are repeatable.
- A term with two senses can produce distinct cards without data duplication hacks.
- Review history can be queried chronologically and cannot be overwritten accidentally through normal repositories.
- Local CRUD is covered by focused repository tests.
- Schema has a documented migration strategy.

---

## T005 — Deterministic demo/seed data and developer utilities

**Priority:** P1  
**Dependencies:** T004

### Scope
- Create a representative seed pack containing nouns, verbs, abstract terms, phrases, multiple senses, context sentences, and source provenance examples.
- Add a developer-only reset/reseed flow.
- Provide deterministic IDs/dates where useful so screenshots/tests are stable.
- Include edge cases: long German-like terms, right-to-left translation text, missing image/audio, duplicate surface terms, and overdue cards.

### Acceptance criteria
- A developer can reset to a known dataset without manual database editing.
- Seed data exercises the important domain edge cases.
- Demo data is isolated from production/user data paths.
