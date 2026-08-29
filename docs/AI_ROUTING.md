# AI routing for smart imports

## Goal

Keep smart imports useful when one free/quota-friendly Gemini model is rate-limited or temporarily unavailable, without putting provider complexity in the mobile UI or blocking local study.

The routing pattern is adapted from the sibling `booking-wizard-ai-salesman` project and intentionally remains server-side.

## Secrets

- `GEMINI_API_KEY` is server-only.
- Never create an `EXPO_PUBLIC_GEMINI_API_KEY` variable.
- A GitHub Actions repository secret named `GEMINI_API_KEY` is available only to workflows that explicitly reference it. It is not automatically injected into deployed Expo/EAS API Routes.
- Configure the same secret name in the EAS server environment before deploying API Routes.
- Do not log the key, request authorization headers, raw imported documents, pasted source text, or transcript contents.

## Text routing

For lightweight text/prose enrichment, try this chain in order:

1. `gemma-4-26b-a4b-it`
2. `gemma-4-31b-it`
3. `gemini-3.1-flash-lite`
4. `gemini-3.5-flash-lite`

The high-daily-request Gemma pool is preferred for frequent lightweight work; Flash-Lite models provide later fallback capacity and broader capabilities.

## Multimodal and URL routing

Do not send video/PDF tasks through Gemma just to reuse the text chain. Capability-specific tasks use:

1. `gemini-3.1-flash-lite`
2. `gemini-3.5-flash-lite`

Current uses:

- public YouTube URL analysis with timestamped vocabulary provenance;
- PDF analysis through Gemini URL Context against a short-lived Neon Object Storage read URL.

This is deliberately task-specific routing rather than one universal model chain.

## Failover rules

Try the next compatible model on:

- 404 model unavailable/not found;
- 408 timeout-like provider response;
- 409 transient provider state;
- 429 quota/rate limit;
- 500/502/503/504 provider failures;
- network errors and per-attempt timeouts.

Stop the chain on clear non-retryable request/auth/validation rejections. Retrying several models cannot fix a malformed request or invalid key and would only waste quota.

Each attempt receives a fair share of one overall deadline so a slow first model cannot consume the entire request budget.

## Output handling

Different Gemma/Gemini models do not have identical structured-output behavior. The application therefore:

- requests JSON explicitly in the prompt;
- strips an optional Markdown JSON fence defensively;
- parses unknown provider output as untrusted data;
- validates required vocabulary fields and numeric scores;
- bounds candidate counts;
- normalizes/deduplicates candidates before staging;
- never renders raw model HTML;
- requires user approval before canonical vocabulary is created.

## Observability

Import-job metrics may record:

- task/source type;
- model attempted and winning model;
- HTTP status/result per attempt;
- latency;
- fallback count;
- provider token usage when returned;
- candidate count;
- input size/character count rather than raw source content.

Provider outages must not block manual entry, local vocabulary lists, sync of already-local data, or the study loop.

## Product scope

Generated image/media enrichment (T037) is intentionally deferred until after MVP validation. The current high-value AI path is source-to-vocabulary curation: text, PDF, and YouTube first, then ranking/sense selection and import reliability. Optional media generation must not delay Gate E or Gate F.
