# Vocab Flow

An Expo vocabulary-learning app with a local-first Bank, fast swipe review, a structured A1 Course Adventure, and Gemini-assisted vocabulary capture.

## Current learning flow

- First launch starts directly in English → Arabic.
- Course Adventure contains the locked A1 lexical/chunk inventory organized as 6 worlds / 45 missions.
- Add selected course items to the shared Bank and study them with quick left/right swipe grading.
- Choose 5, 10, 20, or all due cards before a fresh round.

## Gemini

Manual Add Vocabulary includes **Fill with Gemini** for Arabic meaning, English definition, part of speech, a natural example sentence, and Arabic example translation.

**Gemini Smart Import** supports:

- pasted text or word lists
- one or multiple images (up to three in the quick path)
- camera capture
- uploaded PDFs
- public YouTube URLs
- public web URLs / linked public documents

The import pipeline deliberately runs in two AI stages:

1. Gemini discovers useful English words and phrases without translating everything.
2. The learner selects the candidates they want.
3. Gemini enriches only the selected items with translation and examples.
4. The learner gets a final editable review before anything is added to the Bank.

This keeps model usage lower and prevents unwanted vocabulary from being auto-added.

## Web hosting

Cloudflare Pages is the primary web host. See [`docs/CLOUDFLARE.md`](docs/CLOUDFLARE.md) for build settings and the server-side `GEMINI_API_KEY` requirement.
