export const GEMINI_TEXT_MODEL_CHAIN = [
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
] as const;

const RETRYABLE_STATUSES = new Set([404, 408, 409, 429, 500, 502, 503, 504]);
const DEADLINE_RESERVE_MS = 300;
const MIN_ATTEMPT_MS = 250;

export interface GeminiAttempt {
  model: string;
  status: number | 'timeout' | 'network-error';
  latencyMs: number;
  ok: boolean;
}

export type GeminiRouteResult =
  | {
      ok: true;
      model: string;
      text: string;
      task: string;
      latencyMs: number;
      fallbackCount: number;
      attempts: GeminiAttempt[];
      usage?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    }
  | {
      ok: false;
      error: 'missing-api-key' | 'provider-rejected-request' | 'all-models-unavailable';
      task: string;
      attempts: GeminiAttempt[];
      status?: number;
    };

export function computeGeminiAttemptTimeout(input: {
  attemptTimeoutMs: number;
  overallTimeoutMs: number;
  elapsedMs: number;
  remainingModels: number;
}): number {
  const remainingOverallMs = Math.max(0, input.overallTimeoutMs - input.elapsedMs);
  if (remainingOverallMs <= DEADLINE_RESERVE_MS || input.remainingModels <= 0) return 0;
  const fairShareMs = Math.floor((remainingOverallMs - DEADLINE_RESERVE_MS) / input.remainingModels);
  return Math.max(MIN_ATTEMPT_MS, Math.min(input.attemptTimeoutMs, fairShareMs));
}

function deadlineSignal(timeoutMs: number, parentSignal?: AbortSignal): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onAbort = () => controller.abort(parentSignal?.reason ?? 'parent-abort');
  parentSignal?.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', onAbort);
    },
  };
}

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = (payload as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return '';
  const candidate = candidates[0];
  if (!candidate || typeof candidate !== 'object') return '';
  const content = (candidate as Record<string, unknown>).content;
  if (!content || typeof content !== 'object') return '';
  const parts = (content as Record<string, unknown>).parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string'
      ? String((part as Record<string, unknown>).text)
      : '')
    .join('')
    .trim();
}

function readUsage(payload: unknown): GeminiRouteResult extends { ok: true; usage?: infer U } ? U : never {
  if (!payload || typeof payload !== 'object') return undefined as never;
  const usage = (payload as Record<string, unknown>).usageMetadata;
  if (!usage || typeof usage !== 'object') return undefined as never;
  const record = usage as Record<string, unknown>;
  return {
    ...(typeof record.promptTokenCount === 'number' ? { promptTokenCount: record.promptTokenCount } : {}),
    ...(typeof record.candidatesTokenCount === 'number' ? { candidatesTokenCount: record.candidatesTokenCount } : {}),
    ...(typeof record.totalTokenCount === 'number' ? { totalTokenCount: record.totalTokenCount } : {}),
  } as never;
}

async function callGeminiModel(input: {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  timeoutMs: number;
  signal: AbortSignal;
}): Promise<{
  ok: boolean;
  status: number;
  text: string;
  latencyMs: number;
  usage?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`;
  const attempt = deadlineSignal(input.timeoutMs, input.signal);
  const startedAt = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: attempt.signal,
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': input.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
        generationConfig: {
          maxOutputTokens: input.maxOutputTokens,
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });
    const payload: unknown = await response.json().catch(() => ({}));
    const text = extractText(payload);
    const usage = readUsage(payload);
    return {
      ok: response.ok && Boolean(text),
      status: response.status,
      text,
      latencyMs: Date.now() - startedAt,
      ...(usage ? { usage } : {}),
    };
  } finally {
    attempt.dispose();
  }
}

export async function routeGeminiText(input: {
  apiKey: string | undefined;
  system: string;
  prompt: string;
  task: string;
  maxOutputTokens?: number;
  attemptTimeoutMs?: number;
  overallTimeoutMs?: number;
  models?: readonly string[];
}): Promise<GeminiRouteResult> {
  const apiKey = input.apiKey?.trim();
  if (!apiKey) return { ok: false, error: 'missing-api-key', task: input.task, attempts: [] };

  const models = input.models ?? GEMINI_TEXT_MODEL_CHAIN;
  const attemptTimeoutMs = input.attemptTimeoutMs ?? 4_500;
  const overallTimeoutMs = input.overallTimeoutMs ?? 12_000;
  const overall = deadlineSignal(overallTimeoutMs);
  const attempts: GeminiAttempt[] = [];
  const startedAt = Date.now();

  try {
    for (let index = 0; index < models.length; index += 1) {
      if (overall.signal.aborted) break;
      const model = models[index];
      if (!model) continue;
      const timeoutMs = computeGeminiAttemptTimeout({
        attemptTimeoutMs,
        overallTimeoutMs,
        elapsedMs: Date.now() - startedAt,
        remainingModels: models.length - index,
      });
      if (timeoutMs <= 0) break;

      try {
        const result = await callGeminiModel({
          apiKey,
          model,
          system: input.system,
          prompt: input.prompt,
          maxOutputTokens: input.maxOutputTokens ?? 1_800,
          timeoutMs,
          signal: overall.signal,
        });
        attempts.push({ model, status: result.status, latencyMs: result.latencyMs, ok: result.ok });
        if (result.ok) {
          return {
            ok: true,
            model,
            text: result.text,
            task: input.task,
            latencyMs: Date.now() - startedAt,
            fallbackCount: attempts.length - 1,
            attempts,
            ...(result.usage ? { usage: result.usage } : {}),
          };
        }
        if (!RETRYABLE_STATUSES.has(result.status)) {
          return {
            ok: false,
            error: 'provider-rejected-request',
            status: result.status,
            task: input.task,
            attempts,
          };
        }
      } catch (error) {
        attempts.push({
          model,
          status: error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network-error',
          latencyMs: Math.max(0, Date.now() - startedAt - attempts.reduce((sum, item) => sum + item.latencyMs, 0)),
          ok: false,
        });
      }
    }
  } finally {
    overall.dispose();
  }

  return { ok: false, error: 'all-models-unavailable', task: input.task, attempts };
}
