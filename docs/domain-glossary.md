# Domain Glossary

- **Language Pair** — the target language being learned plus the learner's reference/native language.
- **Term** — a target-language lexical item. It may be a single word or phrase. A term does not own one universal translation.
- **Sense** — one intended meaning of a term, with translation/gloss and optional explanation or note.
- **Card** — a reviewable prompt bound to one term and one sense. Different senses of the same term are distinct cards.
- **Review Event** — immutable record of one grading action (`KNEW` or `FORGOT`) at a point in time.
- **User Card State** — derived mutable scheduling snapshot for a card: lifecycle, repetitions, lapse count, last review, next due date, and version.
- **Collection** — an organizational group such as “Work English” or “Friends S1”. A card's learning state is not duplicated per collection.
- **Collection Item** — membership linking a card to a collection.
- **Source** — where vocabulary originated: manual entry, text, PDF, YouTube, URL, photo, or generated content.
- **Source Occurrence** — a specific appearance of a term/sense in a source, including sentence, page, timestamp, or source-specific locator.
- **Study Session** — a stable local queue of due/new cards plus intentionally scheduled retries.

## Learning lifecycle

- `NEW` — card has never been successfully reviewed.
- `LEARNING` — recall is still fragile or a recent lapse occurred.
- `REVIEW` — card has successful spaced reviews and remains scheduled.
- `MASTERED` — card has demonstrated durable recall across sufficiently separated reviews. It is still reviewable and can return to learning after a lapse.

## Mutability rules

Review events are append-only. Terms, senses, contexts, collections, and source metadata may be edited. User card state is a derived scheduling snapshot and may be recalculated from review history if the scheduler changes.
