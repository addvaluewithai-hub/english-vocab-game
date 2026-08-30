# Cloudflare Pages

Vocab Flow uses Cloudflare Pages for the static Expo web app plus lightweight Pages Functions for Gemini vocabulary enrichment and Smart Import.

## Pages build settings

- Framework preset: `None`
- Build command: `npx expo export --platform web`
- Build output directory: `dist`
- Root directory: repository root
- Production branch: `main`

The Expo app uses `web.output = static`. Files in `public/` are copied into the web output, including `_routes.json`, which limits Pages Function invocations to `/api/*`.

## Gemini secret

Configure this encrypted secret in both Preview and Production environments:

- `GEMINI_API_KEY`

Never prefix the Gemini key with `EXPO_PUBLIC_`; it must remain server-side.

## Gemini endpoints

### `POST /api/enrich-word`

Used by manual Add Vocabulary. It fills the Arabic meaning, concise English definition, part of speech, natural English example sentence, and Arabic example translation.

### `POST /api/discover-vocab`

First pass of Smart Import. It discovers useful English words/phrases only, before spending model work on translations.

Supported sources:

- `TEXT` — pasted text/list/notes
- `PHOTO` — one to three inline images
- `PDF` — uploaded PDF quick path
- `YOUTUBE` — public YouTube URL
- `URL` — public web page or public linked document through Gemini URL Context

Text discovery uses the full text fallback chain. Images/PDF/URL/YouTube use Gemini Flash-Lite multimodal/tool routing rather than Gemma media assumptions.

### `POST /api/enrich-vocab`

Second pass of Smart Import. The app sends only the vocabulary selected by the learner. Items are enriched in batches with Arabic meaning, English definition, part of speech, natural English example, and Arabic example translation. The result then enters the existing editable Review queue before Bank insertion.

## Model routing

Text tasks use:

1. `gemma-4-26b-a4b-it`
2. `gemma-4-31b-it`
3. `gemini-3.1-flash-lite`
4. `gemini-3.5-flash-lite`

Multimodal/tool tasks use:

1. `gemini-3.1-flash-lite`
2. `gemini-3.5-flash-lite`

Retry/fallback is used for quota/rate limits, transient provider errors, unavailable models, network failures, and invalid structured output. Public AI endpoints also apply same-origin checks, request-size caps, and best-effort per-client request limits.

## Native builds

The web app can call `/api/*` on the same origin. Android/iOS builds need the Cloudflare Pages origin configured as:

`EXPO_PUBLIC_API_BASE_URL=https://<your-pages-domain>`

Do not put `GEMINI_API_KEY` in a native build.

## Preview branches

Keep `main` as the production branch. Cloudflare Pages can create preview deployments for non-production branches such as `feat/course-library`. If the Pages project is connected after a branch's latest push, trigger a new branch deployment by pushing another commit or redeploying that branch from the Cloudflare dashboard.
