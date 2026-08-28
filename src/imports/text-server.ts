import type { NormalizedImportCandidate } from './contracts';
import {
  MAX_TEXT_CANDIDATES,
  normalizeAiTextCandidates,
  parseExplicitVocabularyList,
  validatePastedText,
} from './text-parser';

type AiCandidateRow = {
  term: string;
  translation: string;
  definition: string | null;
  partOfSpeech: string | null;
  context: string | null;
  confidence: number;
  usefulness: number;
  isVisuallyConcrete: boolean | null;
};

const candidateSchema = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      maxItems: MAX_TEXT_CANDIDATES,
      items: {
        type: 'object',
        properties: {
          term: { type: 'string' },
          translation: { type: 'string' },
          definition: { type: ['string', 'null'] },
          partOfSpeech: { type: ['string', 'null'] },
          context: { type: ['string', 'null'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          usefulness: { type: 'number', minimum: 0, maximum: 1 },
          isVisuallyConcrete: { type: ['boolean', 'null'] },
        },
        required: [
          'term',
          'translation',
          'definition',
          'partOfSpeech',
          'context',
          'confidence',
          'usefulness',
          'isVisuallyConcrete',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['candidates'],
  additionalProperties: false,
} as const;

function outputText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (typeof record.output_text === 'string') return record.output_text;
  if (!Array.isArray(record.output)) return null;
  for (const item of record.output) {
    if (!item || typeof item !== 'object') continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const piece = part as Record<string, unknown>;
      if (piece.type === 'output_text' && typeof piece.text === 'string') return piece.text;
    }
  }
  return null;
}

function parseRows(text: string): AiCandidateRow[] {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('AI enrichment returned an invalid payload.');
  const candidates = (parsed as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates)) throw new Error('AI enrichment returned no candidate list.');
  return candidates as AiCandidateRow[];
}

async function extractProseWithOpenAI(input: {
  text: string;
  targetLanguageCode: string;
  referenceLanguageCode: string;
}): Promise<NormalizedImportCandidate[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('AI-assisted prose import is not configured for this environment.');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMPORT_MODEL?.trim() || 'gpt-5.6-luna',
      store: false,
      reasoning: { effort: 'low' },
      instructions: [
        'Extract a small, high-value vocabulary study set from the user-provided source text.',
        `The source/target vocabulary language is ${input.targetLanguageCode}; translate or explain it in ${input.referenceLanguageCode}.`,
        `Return at most ${MAX_TEXT_CANDIDATES} useful words or multi-word phrases, not every token.`,
        'Prefer vocabulary that is meaningful in this exact context; preserve phrases and phrasal verbs.',
        'Use the sense that appears in the source. Context must be a short exact or minimally trimmed sentence from the source when available.',
        'Do not invent source context. If uncertain, lower confidence rather than pretending certainty.',
        'Exclude obvious function words, names that are not useful vocabulary, and trivial duplicates.',
      ].join('\n'),
      input: input.text,
      text: {
        format: {
          type: 'json_schema',
          name: 'vocabulary_candidates',
          strict: true,
          schema: candidateSchema,
        },
      },
    }),
  });

  const body: unknown = await response.json();
  if (!response.ok) {
    const message = body && typeof body === 'object' && typeof (body as Record<string, unknown>).error === 'object'
      ? String(((body as Record<string, unknown>).error as Record<string, unknown>).message ?? 'AI enrichment failed.')
      : `AI enrichment failed (${response.status}).`;
    throw new Error(message);
  }
  const text = outputText(body);
  if (!text) throw new Error('AI enrichment returned no usable output.');
  const rows = parseRows(text);
  const normalized = normalizeAiTextCandidates(rows);
  if (normalized.length === 0) throw new Error('No useful vocabulary candidates were found in this text.');
  return normalized;
}

export async function extractTextImportCandidates(input: {
  text: string;
  targetLanguageCode: string;
  referenceLanguageCode: string;
}): Promise<NormalizedImportCandidate[]> {
  const text = validatePastedText(input.text);
  const listCandidates = parseExplicitVocabularyList(text);
  if (listCandidates.length > 0) return listCandidates;
  return extractProseWithOpenAI({ ...input, text });
}
