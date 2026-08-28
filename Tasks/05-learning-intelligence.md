# Phase 05 — Learning Intelligence

Goal: make the app meaningfully better at long-term retention without losing the simple study experience.

---

## T024 — Scheduler interface and FSRS-grade scheduling integration

**Priority:** P1  
**Dependencies:** T009

### Scope
- Preserve a small scheduler interface so UI/services remain independent from algorithm details.
- Integrate an FSRS-grade scheduling implementation or equivalent validated spaced-repetition logic.
- Map existing ReviewEvents/UserCardState into scheduler inputs without discarding history.
- Define migration behavior from the simple scheduler used in the local MVP.
- Keep the user-facing states simple even if internal scheduling parameters are richer.

### Acceptance criteria
- Existing users can move from the simple scheduler without losing review history.
- Next-review outputs are deterministic for identical histories/configuration.
- Scheduler code is testable without rendering UI.
- Changing scheduler implementation does not require rewriting Study screens.

---

## T025 — Pronunciation, audio playback, caching, and replay controls

**Priority:** P1  
**Dependencies:** T013

### Scope
- Add pronunciation/audio fields and playback controls to relevant card/detail surfaces.
- Use modern Expo audio APIs and support generated/remote audio references as well as future imported audio.
- Add caching so previously available pronunciation can play during offline study when practical.
- Define loading/error/fallback behavior when audio is unavailable.
- Avoid auto-playing audio in a way that leaks the answer in modes where listening should be tested separately.

### Acceptance criteria
- Audio can be played/replayed reliably from study and detail contexts.
- Offline cached playback works for previously fetched supported audio.
- Missing/failed audio never blocks grading a card.
- Audio behavior respects app lifecycle and does not continue unexpectedly after leaving study.

---

## T026 — Recall-mode framework: reverse, cloze/context, listening, and typing

**Priority:** P1  
**Dependencies:** T009, T024, T025

### Scope
- Introduce a mode abstraction capable of rendering prompts and validating/self-grading responses for multiple recall styles.
- Implement initial variants: target→meaning recall, reverse recall, context/cloze, listening prompt, and typing where applicable.
- Define which modes are valid for each card based on available content.
- Record mode metadata with ReviewEvents so later analytics can distinguish recognition from stronger recall.
- Preserve the swipe/self-grade experience where it makes sense while allowing objectively graded modes.

### Acceptance criteria
- A card can participate in more than one review mode without duplicating canonical vocabulary data.
- Unsupported modes are skipped gracefully based on card content.
- Review history records mode/result consistently.
- The framework can add a future mode without changing scheduler persistence schema significantly.

---

## T027 — Learning stats, retention insights, streaks, and progress summaries

**Priority:** P1  
**Dependencies:** T009, T024

### Scope
- Build useful summaries from ReviewEvents rather than vanity counts only.
- Include due/reviewed counts, remembered vs forgotten trends, strong/learning totals, and a simple retention-oriented view.
- Add streaks only with forgiving semantics that do not punish users for healthy rest days or zero-due days.
- Distinguish lifetime vocabulary count from genuinely stable/mastered learning state.
- Keep all metrics explainable from stored events/state.

### Acceptance criteria
- Stats remain correct after sync/replay of idempotent review events.
- The UI does not claim a word is “learned forever” based on one success.
- Metrics handle brand-new users and sparse history gracefully.
- At least one insight helps answer “what should I review / how is retention changing?” rather than only displaying totals.

---

## T028 — Daily due reminders and notification preferences

**Priority:** P1  
**Dependencies:** T017, T024

### Scope
- Add opt-in review reminders based on due-card state and user preferences.
- Avoid noisy notifications when nothing is due.
- Support a user-configurable reminder window/time with sensible defaults.
- Recompute/cancel scheduled notifications when due state or preferences change.
- Deep-link notification taps into an appropriate study session.

### Acceptance criteria
- Notifications are opt-in and can be disabled completely.
- Users are not repeatedly reminded after completing the due session.
- Tapping a reminder lands in the correct language pair/study context.
- Behavior is verified on iOS and Android development/beta builds.

---

## T029 — Adaptive card enrichment rules by vocabulary/sense type

**Priority:** P2  
**Dependencies:** T025, T026

### Scope
- Define rules for when images, audio, context, short explanations, or examples are likely to help rather than decorate.
- Prefer images for concrete visual concepts; prefer context/explanation for abstract terms, connectors, idioms, and ambiguous senses.
- Keep enrichment optional and allow manual correction/removal.
- Store enrichment provenance/type so later AI-generated content can be audited/replaced.

### Acceptance criteria
- The app does not assume every vocabulary item needs an image.
- Enrichment selection can be unit-tested from sense metadata/content availability.
- Cards remain useful when no enrichment exists.
- Generated/imported enrichment never overwrites user-authored notes/context silently.
