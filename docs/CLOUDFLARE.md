# Cloudflare Pages

Vocab Flow uses Cloudflare Pages for the web app and a small Pages Function for Gemini vocabulary enrichment.

## Pages build settings

- Framework preset: `None`
- Build command: `npx expo export --platform web`
- Build output directory: `dist`
- Root directory: repository root
- Production branch: `main`

The Expo app uses `web.output = static`. Files in `public/` are copied into the web output, including `_routes.json`, which limits Pages Function invocations to `/api/*`.

## Gemini secret

Configure this secret in both Preview and Production environments:

- `GEMINI_API_KEY`

Never prefix the Gemini key with `EXPO_PUBLIC_`; it must remain server-side.

## AI endpoint

`POST /api/enrich-word`

Body:

```json
{
  "term": "reluctant",
  "kind": "WORD"
}
```

The endpoint returns an editable Arabic meaning, English definition, part of speech, English example sentence, Arabic example translation, and the model that succeeded.

The model fallback chain is:

1. `gemma-4-26b-a4b-it`
2. `gemma-4-31b-it`
3. `gemini-3.1-flash-lite`
4. `gemini-3.5-flash-lite`

Retry/fallback is used for quota/rate limits, transient provider errors, unavailable models, timeouts/network failures, and invalid structured output. The endpoint also applies a same-origin check, request-size cap, and a best-effort per-client request limit.

## Preview branches

Keep `main` as the production branch. Cloudflare Pages can create preview deployments for non-production branches such as `feat/course-library`. If the Pages project is connected after a branch's latest push, trigger a new branch deployment by pushing another commit or redeploying that branch from the Cloudflare dashboard.
