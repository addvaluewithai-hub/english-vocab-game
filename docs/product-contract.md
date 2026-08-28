# Product Contract

## Product
English Vocab Game is a personal vocabulary memory system that turns words and phrases a learner encounters into short, repeatable recall sessions.

## Target user
A language learner who already encounters useful vocabulary in real content and wants a low-friction way to remember it.

## Job to be done
When I encounter vocabulary I want to remember, help me store the intended meaning and context, then show it back to me at useful times so I can practice active recall quickly.

## Core loop
1. Open the app and immediately see the next due card.
2. Recall the meaning before revealing it.
3. Tap to reveal the intended sense and context.
4. Grade with `Forgot` or `Knew it` by button or swipe.
5. Persist a review event and schedule the next review.
6. Continue until the session is complete.

## Learning unit
The canonical model is **Term/Phrase → Sense → Context → Review**. We explicitly do not model vocabulary as `word → one translation` because a surface term may have multiple meanings and a phrase may be a learning unit.

## Success signal
The MVP succeeds when a learner can finish a 10–20 card session quickly, understand why each answer is correct from its context, and return later to see previously graded cards become due again.

## MVP
- Expo mobile app for iOS and Android.
- Offline-first local database.
- Term/phrase, sense, context and source provenance model.
- Manual/demo vocabulary data.
- Study queue.
- Tap-to-flip card.
- Swipe/button grading.
- Append-only review history.
- Simple replaceable scheduler.
- Session progress, retry and completion states.

## Non-goals for the first local MVP
- YouTube/PDF/web ingestion.
- AI vocabulary extraction or enrichment.
- Social/community features.
- Gamified currency/leaderboards.
- Complex deck management.
- Production cloud synchronization.
- FSRS optimization (the scheduler interface must allow it later).

## Internal learning states
- `NEW`: the learner has not produced a successful review yet.
- `LEARNING`: the card is being acquired and may need short retries.
- `REVIEW`: the card has been recalled successfully and is scheduled in the future.
- `MASTERED`: reserved for later evidence-based promotion after repeated spaced success; the simple MVP scheduler does not promote to this state automatically.

## Data invariants
- Review events are append-only.
- Editing a term or sense never rewrites historical review events.
- A term can own many senses.
- A sense can have one or more cards later, but the MVP creates one recall card per sense.
- Source context is optional but first-class.
- Network access may never block grading or advancing to the next card.
