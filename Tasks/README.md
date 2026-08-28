# English Vocab Game — Execution Plan

This folder is the **source of truth for product development**. Every implementation session should start here, select a `READY` task, and update its status here before and after work.

## Status workflow

- `BACKLOG` — planned, but dependencies are not yet satisfied or it is intentionally deferred.
- `READY` — dependencies are satisfied and the task can be picked up now.
- `IN_PROGRESS` — currently being worked on. Prefer one active implementation task at a time unless work is intentionally parallel.
- `BLOCKED` — cannot proceed; record the blocker in the relevant phase file or commit/PR.
- `DONE` — acceptance criteria are met, tests/checks pass, and the implementation is integrated.

**Status rule:** the status column in this file is authoritative. Phase files define task scope and acceptance criteria; they do not maintain a second status field.

## Priority

- `P0` — required for the next release gate or for correctness/security.
- `P1` — important product capability; should follow once the relevant P0 path is stable.
- `P2` — valuable enhancement that must not block core delivery.

## Product principles

1. The product is a **personal vocabulary memory system**, not a generic flashcard editor.
2. The learning unit is `Term/Phrase → Sense → Context → Review`, not `word → translation`.
3. Mobile study must be **offline-first** and instant; network calls must not sit in the swipe path.
4. The Tinder-like swipe is an interaction pattern, not the learning algorithm.
5. Review history is append-only product data; do not reduce learning state to a single boolean.
6. Smart imports must be curated before entering the bank: `source → extract → filter → user approval → bank`.
7. The app should reach a useful local MVP before AI, PDF, YouTube, or other expensive ingestion work.

## Target technology

- Expo + React Native + TypeScript
- Expo Router
- React Native Gesture Handler + Reanimated
- Expo SQLite for local/offline data
- Neon Postgres for cloud persistence
- Neon Auth as the preferred account/authentication layer
- Authenticated server/Data API boundary between the mobile client and cloud data; privileged Postgres credentials never ship in the app
- Object storage selected alongside Neon for imported files/media (prefer Neon Object Storage when it fits the implementation requirements)
- EAS development builds, beta distribution, and production builds
- Scheduler abstraction with FSRS-grade scheduling behind a replaceable interface

## Release gates

- **Gate A — Interactive Prototype:** flip + swipe + local demo cards feel excellent.
- **Gate B — Local MVP:** real local vocabulary bank, manual CRUD, study queue, scheduler, history, collections.
- **Gate C — Cloud Beta:** auth, offline-first sync, conflict recovery, backup/restore.
- **Gate D — Learning V1:** FSRS-grade scheduling, pronunciation/audio, varied recall modes, useful stats/reminders.
- **Gate E — Smart Imports:** text/PDF/YouTube imports with filtering, dedupe, source context, and approval.
- **Gate F — Store Release:** privacy/security, testing, observability, performance, beta validation, store submission.

## Task board

| ID | Task | Priority | Depends on | Gate | Status |
|---|---|---:|---|---|---|
| T001 | Product contract, domain glossary, and architecture decisions | P0 | — | A | DONE |
| T002 | Expo TypeScript scaffold and navigation shell | P0 | T001 | A | DONE |
| T003 | Design system and reusable interaction primitives | P0 | T002 | A | DONE |
| T004 | Local domain model, SQLite schema, migrations, and repository layer | P0 | T001, T002 | B | DONE |
| T005 | Deterministic demo/seed data and developer utilities | P1 | T004 | A/B | DONE |
| T006 | Study queue and session state service | P0 | T004, T005 | B | DONE |
| T007 | Vocabulary card front/back and flip interaction | P0 | T003, T006 | A | DONE |
| T008 | Swipe grading, buttons, gesture feedback, and haptics | P0 | T007 | A | DONE |
| T009 | Review event persistence and simple scheduling engine | P0 | T006, T008 | B | DONE |
| T010 | Study progress, completion, due/empty states, and retry flow | P0 | T009 | B | DONE |
| T011 | Core study loop polish, accessibility, and device responsiveness | P0 | T007, T008, T010 | A/B | DONE |
| T012 | Vocabulary bank browse, search, filter, and state grouping | P0 | T003, T004 | B | DONE |
| T013 | Manual term/sense/context create and edit flow | P0 | T004, T012 | B | DONE |
| T014 | Collections and source provenance model/UI | P1 | T004, T013 | B | DONE |
| T015 | Vocabulary detail, review history, and source-context screen | P1 | T009, T012, T014 | B | DONE |
| T016 | Import staging and review-before-add UX | P1 | T012, T014 | E | DONE |
| T017 | Language-pair onboarding and app settings | P1 | T002, T004 | B/C | DONE |
| T018 | Neon cloud schema, migrations, access control, and storage strategy | P0 | T004 | C | DONE |
| T019 | Neon Auth and guest-to-account migration | P1 | T017, T018 | C | DONE |
| T020 | Offline sync protocol: outbox, versions, tombstones, and sync contract | P0 | T004, T018 | C | DONE |
| T021 | Offline-first sync engine implementation | P0 | T020 | C | DONE |
| T022 | Conflict handling, retry/recovery, and sync-status UX | P0 | T021 | C | DONE |
| T023 | Backup/restore and multi-device verification | P1 | T019, T022 | C | DONE |
| T024 | Scheduler interface and FSRS-grade scheduling integration | P1 | T009 | D | DONE |
| T025 | Pronunciation, audio playback, caching, and replay controls | P1 | T013 | D | DONE |
| T026 | Recall-mode framework: reverse, cloze/context, listening, and typing | P1 | T009, T024, T025 | D | DONE |
| T027 | Learning stats, retention insights, streaks, and progress summaries | P1 | T009, T024 | D | DONE |
| T028 | Daily due reminders and notification preferences | P1 | T017, T024 | D | BLOCKED |
| T029 | Adaptive card enrichment rules by vocabulary/sense type | P2 | T025, T026 | D/E | DONE |
| T030 | Import job architecture and ingestion pipeline framework | P1 | T016, T018, T021 | E | DONE |
| T031 | Paste/text/list import with normalization, dedupe, and enrichment | P1 | T030 | E | READY |
| T032 | PDF import with extraction, page provenance, and context capture | P1 | T030 | E | READY |
| T033 | YouTube import with transcript extraction and timestamp provenance | P1 | T030 | E | READY |
| T034 | Web article/URL import with clean-text extraction and provenance | P2 | T030 | E | READY |
| T035 | Photo/image vocabulary import with OCR workflow and review staging | P2 | T030 | E | READY |
| T036 | AI usefulness/level filtering, sense selection, and import approval ranking | P1 | T031, T032, T033 | E | BACKLOG |
| T037 | Optional media/image enrichment generation, caching, and storage controls | P2 | T029, T030 | E | READY |
| T038 | Import failures, limits, cost controls, observability, and retry UX | P1 | T030, T031, T032, T033 | E | BACKLOG |
| T039 | Privacy-safe analytics and production error reporting | P1 | T010, T021 | F | READY |
| T040 | Security/privacy controls, data export, account deletion, and retention policy | P0 | T018, T019 | F | READY |
| T041 | Performance, offline, storage, memory, and battery hardening | P0 | T022, T036 | F | BACKLOG |
| T042 | End-to-end test suite and CI quality gates | P0 | T023, T036 | F | BACKLOG |
| T043 | Internal beta builds, feedback capture, and release feedback loop | P0 | T039, T040, T041, T042 | F | BACKLOG |
| T044 | Store readiness: onboarding polish, permissions, privacy copy, metadata, assets | P0 | T043 | F | BACKLOG |
| T045 | Release-candidate hardening and production launch | P0 | T044 | F | BACKLOG |
| T046 | Post-launch monitoring, feedback triage, and release cadence | P1 | T045 | Post-launch | BACKLOG |

## Recommended execution order

Follow dependencies rather than blindly following numeric order. The intended critical path is:

`T001 → T002 → T003/T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011/T012/T013 → T014/T017 → T018 → T020 → T021 → T022 → T019/T023 → T024–T028 → T030 → T031–T033 → T036/T038 → T039–T045 → T046`

Parallel work is safe where dependencies allow it. For example, UI primitives (`T003`) and local data foundations (`T004`) can proceed in parallel after the Expo shell exists.

## Definition of done for every task

A task is `DONE` only when:

- its acceptance criteria in the phase file are satisfied;
- the implementation is integrated into the default development branch;
- relevant tests/checks pass;
- no known P0 regression is introduced;
- any architectural or product decision introduced by the task is documented;
- this board is updated to `DONE`, and newly unblocked tasks are moved to `READY`.

## Phase specifications

- [`01-foundation.md`](./01-foundation.md)
- [`02-core-learning-loop.md`](./02-core-learning-loop.md)
- [`03-bank-and-content.md`](./03-bank-and-content.md)
- [`04-cloud-and-sync.md`](./04-cloud-and-sync.md)
- [`05-learning-intelligence.md`](./05-learning-intelligence.md)
- [`06-smart-imports.md`](./06-smart-imports.md)
- [`07-quality-and-release.md`](./07-quality-and-release.md)

## Planning policy

This roadmap should evolve when implementation teaches us something new, but changes should be deliberate. If a task becomes too large for one focused work session, split it before implementation and update dependencies here. If two tasks are consistently inseparable, merge them and preserve the original intent in the commit history.
