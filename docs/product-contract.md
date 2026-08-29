# Product Contract

## Product
English Vocab Game is a personal vocabulary memory system that turns words and phrases a learner encounters into short, repeatable recall sessions.

The product experience is intentionally **swipe-first**: a learner should spend most study time with one card in front of them, reveal the intended sense/context, then move immediately with `Forgot` or `Knew it` by swipe or button. New features should feed, improve, or protect that loop rather than create a competing lesson/LMS experience.

## Target user
A language learner who already encounters useful vocabulary in real content and wants a low-friction way to remember it.

## Job to be done
When I encounter vocabulary I want to remember, help me store the intended meaning and context, then show it back to me at useful times so I can practice active recall quickly.

## Core loop
1. Open the app and immediately see the next selected card.
2. Recall the meaning before revealing it.
3. Tap to reveal the intended sense and context.
4. Grade with `Forgot` or `Knew it` by button or swipe.
5. Persist a review event and schedule the next review.
6. Continue until the short session is complete.
7. If more cards are available, offer another batch; never silently loop the whole bank.

## Session contract
The vocabulary bank may become large, but **bank size is never session size**.

- A normal session is bounded to at most 20 initial cards.
- Due/learning reviews have priority over unseen cards.
- At most 10 unseen/new cards enter one session by default.
- A forgotten card may receive one intentional same-session retry; retries may make the final swipe count slightly larger than the initial batch.
- Completing a batch is a real completion state. If more cards are ready, the learner explicitly chooses whether to continue.
- The exact limits may become configurable later, but the invariant is permanent: large banks must remain quick to study.

## Learning unit
The canonical model is **Term/Phrase → Sense → Context → Review**. We explicitly do not model vocabulary as `word → one translation` because a surface term may have multiple meanings and a phrase may be a learning unit.

## Content inputs
All vocabulary sources ultimately feed the same personal memory loop:

- manual entry;
- pasted text or vocabulary lists;
- PDF, YouTube, web, image, and other imported material;
- optional curated built-in vocabulary/chunks supplied by the product.

A source does not create a separate learning system. If the same sense already exists in the learner's bank, new source encounters should reuse/link it rather than create parallel cards blindly.

## Curated built-in content boundary
The separate `english-course` repository may inform future built-in vocabulary feeds. Useful reusable material includes reviewed CEFR level metadata, topics, practical phrases/chunks, collocations, meanings, and vetted contextual examples.

The vocabulary app is **not** adopting the course's lesson player, full unit progression, mastery assessments, videos, teacher workflow, or LMS architecture. Curated content should arrive as an optional source of good cards and then use the same swipe + scheduler experience as personal vocabulary.

Any future integration should consume a versioned reviewed export rather than copy raw curriculum/evidence files into app code.

## Success signal
The MVP succeeds when a learner can finish a 10–20 card session quickly, understand why each answer is correct from its context, and return later to see previously graded cards become due again.

## MVP
- Expo mobile app for iOS and Android.
- Offline-first local database.
- Term/phrase, sense, context and source provenance model.
- Manual/demo vocabulary data.
- Bounded study queue.
- Tap-to-flip card.
- Swipe/button grading.
- Append-only review history.
- Simple replaceable scheduler.
- Session progress, retry and completion states.

## Non-goals for the first local MVP
- A course/LMS lesson player.
- Full curriculum/unit progression inside the vocabulary app.
- Social/community features.
- Gamified currency/leaderboards.
- Complex deck management.

Smart imports, cloud sync, FSRS-grade scheduling, recall modes, pronunciation, and other later gates may extend the MVP, but they must preserve the swipe-first interaction contract.

## Internal learning states
- `NEW`: the learner has not produced a successful review yet.
- `LEARNING`: the card is being acquired and may need short retries.
- `REVIEW`: the card has been recalled successfully and is scheduled in the future.
- `MASTERED`: evidence-based promotion after repeated spaced success.

## Data invariants
- Review events are append-only.
- Editing a term or sense never rewrites historical review events.
- A term can own many senses.
- A sense can have one or more cards later, but the MVP creates one recall card per sense.
- Source context is optional but first-class.
- Network access may never block grading or advancing to the next card.
- Content origin must not create duplicate learning state for the same canonical sense.
