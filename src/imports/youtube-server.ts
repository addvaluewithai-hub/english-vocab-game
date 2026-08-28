import type { NormalizedImportCandidate } from './contracts';
import { isLearnerLevel, type LearnerLevel } from './ranking';
import { normalizeYouTubeUrl } from './youtube';
import {
  GEMINI_VIDEO_MODEL_CHAIN,
  routeGeminiContent,
  type GeminiAttempt,
  type GeminiUsage,
} from '@/server/gemini-router';

const MAX_YOUTUBE_CANDIDATES = 32;

interface YouTubeCandidateRow {
  candidateKey: string;
  term: string;
  translation: string;
  definition: string | null;
  partOfSpeech: string | null;
  context: string | null;
  timestampSeconds: number | null;
  confidence: number;
  usefulness: number;
  cefrLevel: LearnerLevel | null;
  isVisuallyConcrete: boolean | null;
}

export interface YouTubeExtraction {
  candidates: NormalizedImportCandidate[];
  model: string;
  fallbackCount: number;
  attempts: GeminiAttempt[];
  usage?: GeminiUsage;
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const clean = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;
  return JSON.parse(clean);
}

function score(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

function rowsFromModel(text: string): YouTubeCandidateRow[] {
  const parsed = parseJson(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('YOUTUBE_INVALID_MODEL_OUTPUT');
  const candidates = (parsed as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates)) throw new Error('YOUTUBE_INVALID_MODEL_OUTPUT');
  const rows: YouTubeCandidateRow[] = [];
  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.term !== 'string' || typeof row.translation !== 'string') continue;
    const confidence = score(row.confidence);
    const usefulness = score(row.usefulness);
    if (confidence === null || usefulness === null) continue;
    const rawTimestamp = typeof row.timestampSeconds === 'number' && Number.isFinite(row.timestampSeconds)
      ? Math.max(0, Math.round(row.timestampSeconds))
      : null;
    rows.push({
      candidateKey: typeof row.candidateKey === 'string' ? row.candidateKey.trim() : '',
      term: row.term,
      translation: row.translation,
      definition: nullableText(row.definition),
      partOfSpeech: nullableText(row.partOfSpeech),
      context: nullableText(row.context),
      timestampSeconds: rawTimestamp,
      confidence,
      usefulness,
      cefrLevel: isLearnerLevel(row.cefrLevel) ? row.cefrLevel : null,
      isVisuallyConcrete: typeof row.isVisuallyConcrete === 'boolean' ? row.isVisuallyConcrete : null,
    });
    if (rows.length >= MAX_YOUTUBE_CANDIDATES) break;
  }
  return rows;
}

function normalizeRows(rows: YouTubeCandidateRow[], canonicalUrl: string): NormalizedImportCandidate[] {
  const seen = new Set<string>();
  const output: NormalizedImportCandidate[] = [];
  for (const row of rows) {
    const term = row.term.trim().replace(/\s+/g, ' ');
    const translation = row.translation.trim().replace(/\s+/g, ' ');
    if (!term || !translation) continue;
    const identity = `${term.toLocaleLowerCase()}\u0000${translation.toLocaleLowerCase()}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const timestamp = row.timestampSeconds;
    output.push({
      candidateKey: row.candidateKey || `youtube-${output.length + 1}`,
      term,
      translation,
      definition: row.definition,
      partOfSpeech: row.partOfSpeech,
      context: row.context,
      occurrence: {
        sentence: row.context,
        sourceUri: canonicalUrl,
        locator: timestamp === null ? null : `t=${timestamp}s`,
        pageNumber: null,
        timestampSeconds: timestamp,
      },
      confidence: row.confidence,
      usefulness: row.usefulness,
      cefrLevel: row.cefrLevel,
      duplicateHint: null,
      isVisuallyConcrete: row.isVisuallyConcrete,
    });
  }
  if (!output.length) throw new Error('YOUTUBE_NO_CANDIDATES');
  return output;
}

export async function extractYouTubeVocabulary(input: {
  url: string;
  targetLanguageCode: string;
  referenceLanguageCode: string;
  learnerLevel: LearnerLevel;
}): Promise<YouTubeExtraction> {
  const source = normalizeYouTubeUrl(input.url);
  const prompt = [
    'Extract a compact vocabulary-learning set from this public YouTube video.',
    `Vocabulary is in ${input.targetLanguageCode}; meanings or translations must be in ${input.referenceLanguageCode}.`,
    `The learner is approximately CEFR ${input.learnerLevel}. Prefer useful items around that level and up to one level above while preserving important phrases used in context.`,
    `Return at most ${MAX_YOUTUBE_CANDIDATES} high-value words or multi-word phrases, not every word.`,
    'Prefer vocabulary that is actually spoken or clearly used in the video context. Preserve phrases and phrasal verbs.',
    'Use the sense present at the cited moment. Context should be a short faithful spoken sentence or minimally normalized excerpt when confidently heard; otherwise null.',
    'timestampSeconds must be the approximate 0-based second where the representative occurrence begins; use null only when a reliable timestamp cannot be determined.',
    'cefrLevel must be A1, A2, B1, B2, C1, C2, or null when uncertain.',
    'Do not invent quotations, timestamps, definitions, or translations. Lower confidence if uncertain.',
    'Return JSON only, no Markdown. Shape:',
    '{"candidates":[{"candidateKey":"...","term":"...","translation":"...","definition":null,"partOfSpeech":null,"context":null,"timestampSeconds":12,"confidence":0.9,"usefulness":0.9,"cefrLevel":"B1","isVisuallyConcrete":null}]}',
  ].join('\n');

  const result = await routeGeminiContent({
    apiKey: process.env.GEMINI_API_KEY,
    system: 'You are a conservative vocabulary curator. Output machine-readable JSON only and prefer precision over candidate count.',
    parts: [
      { file_data: { file_uri: source.canonicalUrl, mime_type: 'video/*' } },
      { text: prompt },
    ],
    task: 'vocabulary_youtube_import',
    models: GEMINI_VIDEO_MODEL_CHAIN,
    maxOutputTokens: 2_800,
    attemptTimeoutMs: 18_000,
    overallTimeoutMs: 38_000,
  });

  if (!result.ok) {
    if (result.error === 'missing-api-key') throw new Error('AI_IMPORT_NOT_CONFIGURED');
    if (result.error === 'provider-rejected-request') {
      if (result.status === 400 || result.status === 403 || result.status === 404) {
        throw new Error('YOUTUBE_UNAVAILABLE_OR_NOT_PUBLIC');
      }
      throw new Error(`YOUTUBE_PROVIDER_REJECTED:${result.status ?? 'unknown'}`);
    }
    throw new Error('YOUTUBE_PROVIDER_UNAVAILABLE');
  }

  return {
    candidates: normalizeRows(rowsFromModel(result.text), source.canonicalUrl),
    model: result.model,
    fallbackCount: result.fallbackCount,
    attempts: result.attempts,
    ...(result.usage ? { usage: result.usage } : {}),
  };
}
