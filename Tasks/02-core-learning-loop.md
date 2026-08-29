# Phase 02 — Core Learning Loop

Goal: prove that studying vocabulary through a fast flip-and-swipe loop is useful, memorable, and delightful before adding cloud or AI complexity.

---

## T006 — Study queue and session state service

**Priority:** P0  
**Dependencies:** T004, T005

### Scope
- Build a local service that selects cards due for study and creates a stable session queue.
- Support new cards, due review cards, and retry cards without coupling queue logic to the screen component.
- Define behavior when a card is edited/deleted while a session exists.
- Keep the queue fully local and instant; no network request may block the next card.
- Expose progress counts and current-card metadata to the UI.

### Acceptance criteria
- Given deterministic seed data, queue order and counts are testable and repeatable.
- Duplicate card appearances do not occur unless intentionally scheduled for retry.
- Empty/no-due states are represented explicitly rather than as errors.
- Session state survives ordinary route transitions without corrupting progress.

---

## T007 — Vocabulary card front/back and flip interaction

**Priority:** P0  
**Dependencies:** T003, T006

### Scope
- Build the central study card with a clear front showing the target-language term/phrase.
- Build a back showing the selected sense/translation, context, and optional enrichment slots.
- Implement tap-to-flip with smooth, interruption-safe animation.
- Support absent image/audio/note fields without broken layout.
- Make long words, phrases, RTL translations, and multiline contexts readable.

### Acceptance criteria
- Front never leaks the answer before reveal.
- Flip works repeatedly without visual glitches or stale content when the next card loads.
- Card layout remains usable across representative phone sizes and accessibility font settings.
- Optional fields collapse cleanly when absent.

---

## T008 — Swipe grading, buttons, gesture feedback, and haptics

**Priority:** P0  
**Dependencies:** T007

### Scope
- Implement drag/swipe interaction with right = knew it and left = forgot it.
- Add explicit buttons providing the same actions for discoverability/accessibility.
- Show progressive semantic feedback while dragging, not only after release.
- Add appropriate haptic feedback where supported and respect reduced-motion/accessibility settings.
- Prevent accidental double-submission or grading while the answer is still hidden.

### Acceptance criteria
- One physical gesture creates exactly one grading action.
- Buttons and gestures produce identical domain events.
- Threshold/cancel behavior feels predictable and is covered by tests where practical.
- A user can complete the study loop without using swipe gestures.

---

## T009 — Review event persistence and simple scheduling engine

**Priority:** P0  
**Dependencies:** T006, T008

### Scope
- Persist every grading action as an append-only ReviewEvent with result and timestamp.
- Implement a deliberately simple first scheduler behind a stable scheduler interface.
- Derive/update UserCardState: last review, next due time, repetitions/strength state, and relevant counters.
- Ensure wrong answers become available for appropriate retry without creating event duplicates.
- Keep scheduler implementation replaceable by FSRS later.

### Acceptance criteria
- Correct/wrong actions create review history and a deterministic next-review decision.
- Replaying/reloading a screen does not duplicate review events.
- Scheduler behavior has unit tests for first-seen, correct, wrong, overdue, and repeated-review scenarios.
- UI code does not contain scheduling math.

---

## T010 — Study progress, completion, due/empty states, and retry flow

**Priority:** P0  
**Dependencies:** T009

### Scope
- Show unobtrusive session progress such as current/total or remaining count.
- Build session-complete state with remembered/forgotten summary.
- Build no-vocabulary and nothing-due states with clear next actions.
- Define and implement same-session retry behavior for forgotten cards without creating an endless loop.
- Allow leaving/restarting a session safely.

### Acceptance criteria
- Session completion is reachable under all normal grading paths.
- Forgotten-card retry policy is deterministic and documented.
- Empty states guide the user toward adding vocabulary or returning later as appropriate.
- Progress remains correct after navigation away/back.

---

## T011 — Core study loop polish, accessibility, and device responsiveness

**Priority:** P0  
**Dependencies:** T007, T008, T010

### Scope
- Tune animation timing, gesture feel, visual hierarchy, card density, and transition continuity.
- Verify VoiceOver/TalkBack labels and logical focus order for reveal and grading actions.
- Verify reduced motion, font scaling, small screens, large screens, and RTL answer content.
- Add meaningful loading/error fallbacks for local initialization failures.
- Perform a focused usability pass on the full `open → recall → flip → grade → next → complete` loop.

### Acceptance criteria
- Gate A can be demonstrated end-to-end using seeded cards with no cloud dependency.
- Core loop is fully operable with screen reader and buttons only.
- No known layout blocker exists on representative iOS and Android phone sizes.
- Interaction does not noticeably stall between graded cards.

---

## T047 — Bounded swipe feed and large-bank queue policy

**Priority:** P0  
**Dependencies:** T006, T010, T024

### Scope
- Preserve the Tinder-like one-card swipe as the primary study experience even when a learner has a very large vocabulary bank.
- Bound one session to a short initial batch rather than treating every due/new card as one endless queue.
- Prioritize due/learning reviews before unseen vocabulary.
- Limit unseen/new cards per session so imports or a large bank cannot flood the learner.
- Keep the existing one-retry-per-forgotten-card behavior.
- On completion, explicitly offer another batch when more study-ready cards remain; never auto-loop the whole bank.

### Current defaults
- Maximum 20 initial cards per session.
- Maximum 10 unseen/new cards per session.
- Forgotten-card retries may make the final swipe count slightly larger than the initial batch.

These are safe defaults, not a permanent claim that every learner must use the same numbers. Later preference/adaptation work may tune them without changing the bounded-session invariant.

### Acceptance criteria
- A bank containing thousands of new cards creates a short deterministic session, not a thousands-card queue.
- Due reviews are selected before new cards.
- The initial session never exceeds the configured session cap.
- Completion reports that more cards are available and requires an explicit learner action to start another batch.
- Existing retry, review-event, FSRS, offline, and route-transition behavior remains intact.
