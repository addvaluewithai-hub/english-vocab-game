import type { NormalizedImportCandidate } from './contracts';
import { isLearnerLevel, type LearnerLevel } from './ranking';
import {
  AI_LIST_BATCH_SIZE,
  MAX_TEXT_CANDIDATES,
  normalizeAiTextCandidates,
  parseLooseVocabularyList,
  type ParsedVocabularyListItem,
  validatePastedText,
} from './text-parser';
import { routeGeminiText, type GeminiAttempt } from '@/server/gemini-router';

type AiCandidateRow = {
  inputIndex: number | null;
  term: string;
  translation: string;
  definition: string | null;
  partOfSpeech: string | null;
  context: string | null;
  confidence: number;
  usefulness: number;
  cefrLevel: LearnerLevel | null;
  isVisuallyConcrete: boolean | null;
};

export interface TextImportExtraction {
  candidates: NormalizedImportCandidate[];
  provider: 'LOCAL_LIST' | 'GEMINI_LIST_ENRICH' | 'GEMINI_ROUTER';
  model: string | null;
  fallbackCount: number;
  attempts: GeminiAttempt[];
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

function jsonPayload(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;
  return JSON.parse(unfenced);
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function score(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
}

function parseRows(text: string, limit: number): AiCandidateRow[] {
  const parsed = jsonPayload(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('AI enrichment returned an invalid payload.');
  const candidates = (parsed as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates)) throw new Error('AI enrichment returned no candidate list.');

  const rows: AiCandidateRow[] = [];
  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.term !== 'string' || typeof row.translation !== 'string') continue;
    const confidence = score(row.confidence);
    const usefulness = score(row.usefulness);
    if (confidence === null || usefulness === null) continue;
    rows.push({
      inputIndex: typeof row.inputIndex === 'number' && Number.isInteger(row.inputIndex) ? row.inputIndex : null,
      term: row.term,
      translation: row.translation,
      definition: nullableString(row.definition),
      partOfSpeech: nullableString(row.partOfSpeech),
      context: nullableString(row.context),
      confidence,
      usefulness,
      cefrLevel: isLearnerLevel(row.cefrLevel) ? row.cefrLevel : null,
      isVisuallyConcrete: typeof row.isVisuallyConcrete === 'boolean' ? row.isVisuallyConcrete : null,
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

export async function enrichVocabularyListBatch(input: {
  items: ParsedVocabularyListItem[];
  targetLanguageCode: string;
  referenceLanguageCode: string;
  learnerLevel: LearnerLevel;
}): Promise<TextImportExtraction> {
  if (input.items.length === 0) throw new Error('No vocabulary items were provided.');
  if (input.items.length > AI_LIST_BATCH_SIZE) throw new Error(`Vocabulary enrichment batches are limited to ${AI_LIST_BATCH_SIZE} items.`);

  const system = [
    'You enrich a user-provided vocabulary list for a language-learning app.',
    'Return JSON only. Never wrap it in Markdown.',
    `Terms are in ${input.targetLanguageCode}; translations and explanations are in ${input.referenceLanguageCode}.`,
    `The learner is approximately CEFR ${input.learnerLevel}.`,
    'Return exactly one candidate for every input item and preserve inputIndex.',
    'Preserve the exact input term spelling unless it contains obvious surrounding whitespace.',
    'If the user supplied a translation, preserve that intended sense; only replace it when it is clearly unusable or in the wrong language.',
    'If translation is null, provide a concise natural translation for the most useful/common sense.',
    'Provide a short definition only when it adds value beyond the translation.',
    'Provide partOfSpeech when reasonably clear.',
    'Generate one short, natural example sentence in the target language as context. This is a generated study example, not source provenance.',
    'Scores confidence and usefulness must be numbers from 0 to 1.',
    'cefrLevel must be A1, A2, B1, B2, C1, C2, or null when uncertain.',
    'isVisuallyConcrete is true only for a clearly visual/concrete sense, false for clearly non-visual, otherwise null.',
  ].join('\n');
  const sourceItems = input.items.map((item, inputIndex) => ({
    inputIndex,
    term: item.term,
    translation: item.translation,
  }));
  const prompt = [
    'Return exactly this JSON shape:',
    '{"candidates":[{"inputIndex":0,"term":"...","translation":"...","definition":null,"partOfSpeech":null,"context":"generated example sentence","confidence":0.9,"usefulness":0.9,"cefrLevel":"B1","isVisuallyConcrete":null}]}',
    '',
    'INPUT ITEMS:',
    JSON.stringify(sourceItems),
  ].join('\n');

  const routed = await routeGeminiText({
    apiKey: process.env.GEMINI_API_KEY,
    system,
    prompt,
    task: 'vocabulary_list_enrichment',
    maxOutputTokens: 5_500,
    attemptTimeoutMs: 7_000,
    overallTimeoutMs: 22_000,
  });

  if (!routed.ok) {
    if (routed.error === 'missing-api-key') throw new Error('AI-assisted vocabulary enrichment is not configured for this environment.');
    if (routed.error === 'provider-rejected-request') throw new Error(`AI enrichment request was rejected (${routed.status ?? 'unknown'}).`);
    throw new Error('All configured Gemini/Gemma import models are temporarily unavailable.');
  }

  const rows = parseRows(routed.text, input.items.length);
  const byIndex = new Map<number, AiCandidateRow>();
  rows.forEach((row, fallbackIndex) => {
    const index = row.inputIndex ?? fallbackIndex;
    if (index >= 0 && index < input.items.length && !byIndex.has(index)) byIndex.set(index, row);
  });

  const mergedRows: Omit<AiCandidateRow, 'inputIndex'>[] = [];
  input.items.forEach((item, index) => {
    const row = byIndex.get(index);
    if (!row) return;
    const translation = item.translation?.trim() || row.translation.trim();
    if (!translation) return;
    mergedRows.push({
      term: item.term,
      translation,
      definition: row.definition,
      partOfSpeech: row.partOfSpeech,
      context: row.context,
      confidence: row.confidence,
      usefulness: row.usefulness,
      cefrLevel: row.cefrLevel,
      isVisuallyConcrete: row.isVisuallyConcrete,
    });
  });

  const candidates = normalizeAiTextCandidates(mergedRows, {
    contextIsSource: false,
    maxCandidates: input.items.length,
    candidatePrefix: 'list-ai',
  });
  if (candidates.length === 0) throw new Error('AI enrichment returned no usable vocabulary items.');

  return {
    candidates,
    provider: 'GEMINI_LIST_ENRICH',
    model: routed.model,
    fallbackCount: routed.fallbackCount,
    attempts: routed.attempts,
    ...(routed.usage ? { usage: routed.usage } : {}),
  };
}

async function extractProseWithGemini(input: {
  text: string;
  targetLanguageCode: string;
  referenceLanguageCode: string;
  learnerLevel: LearnerLevel;
}): Promise<TextImportExtraction> {
  const system = [
    'You curate a compact vocabulary study set from user-provided source text.',
    'Return JSON only. Never wrap it in Markdown.',
    `Vocabulary is in ${input.targetLanguageCode}; translate or explain it in ${input.referenceLanguageCode}.`,
    `The learner is approximately CEFR ${input.learnerLevel}. Prefer useful items around that level and up to one level above; do not delete contextually important easier/harder phrases solely because of level.`,
    `Return at most ${MAX_TEXT_CANDIDATES} useful words or multi-word phrases, not every token.`,
    'Prefer vocabulary that is meaningful in this exact context; preserve phrases and phrasal verbs.',
    'Use the sense that appears in the source. Context must be a short exact or minimally trimmed sentence from the source when available.',
    'Do not invent source context. If uncertain, lower confidence rather than pretending certainty.',
    'Exclude obvious function words, names that are not useful vocabulary, and trivial duplicates.',
    'Scores confidence and usefulness must be numbers from 0 to 1.',
    'cefrLevel must be A1, A2, B1, B2, C1, C2, or null when uncertain.',
    'isVisuallyConcrete is true only for a clearly visual/concrete sense, false for clearly non-visual, otherwise null.',
  ].join('\n');
  const prompt = [
    'Return exactly this JSON shape:',
    '{"candidates":[{"term":"...","translation":"...","definition":null,"partOfSpeech":null,"context":null,"confidence":0.9,"usefulness":0.9,"cefrLevel":"B1","isVisuallyConcrete":null}]}',
    '',
    'SOURCE TEXT:',
    input.text,
  ].join('\n');

  const routed = await routeGeminiText({
    apiKey: process.env.GEMINI_API_KEY,
    system,
    prompt,
    task: 'vocabulary_text_import',
    maxOutputTokens: 2_200,
    attemptTimeoutMs: 5_000,
    overallTimeoutMs: 16_000,
  });

  if (!routed.ok) {
    if (routed.error === 'missing-api-key') throw new Error('AI-assisted prose import is not configured for this environment.');
    if (routed.error === 'provider-rejected-request') throw new Error(`AI enrichment request was rejected (${routed.status ?? 'unknown'}).`);
    throw new Error('All configured Gemini/Gemma import models are temporarily unavailable.');
  }

  const normalized = normalizeAiTextCandidates(parseRows(routed.text, MAX_TEXT_CANDIDATES));
  if (normalized.length === 0) throw new Error('No useful vocabulary candidates were found in this text.');
  return {
    candidates: normalized,
    provider: 'GEMINI_ROUTER',
    model: routed.model,
    fallbackCount: routed.fallbackCount,
    attempts: routed.attempts,
    ...(routed.usage ? { usage: routed.usage } : {}),
  };
}

export async function extractTextImport(input: {
  text: string;
  targetLanguageCode: string;
  referenceLanguageCode: string;
  learnerLevel: LearnerLevel;
}): Promise<TextImportExtraction> {
  const text = validatePastedText(input.text);
  const listItems = parseLooseVocabularyList(text);
  if (listItems.length > 0) {
    if (listItems.length > AI_LIST_BATCH_SIZE) throw new Error('TEXT_BATCH_REQUIRED');
    return enrichVocabularyListBatch({ ...input, items: listItems });
  }
  return extractProseWithGemini({ ...input, text });
}

export async function extractTextImportCandidates(input: {
  text: string;
  targetLanguageCode: string;
  referenceLanguageCode: string;
  learnerLevel: LearnerLevel;
}): Promise<NormalizedImportCandidate[]> {
  return (await extractTextImport(input)).candidates;
}
