import type { NormalizedImportCandidate } from './contracts';
import { IMPORT_POLICY } from './policy';
import { isLearnerLevel, type LearnerLevel } from './ranking';
import { createImportReadUrl, IMPORT_BUCKET } from '@/server/object-storage';
import {
  GEMINI_URL_MODEL_CHAIN,
  routeGeminiContent,
  type GeminiAttempt,
  type GeminiUsage,
} from '@/server/gemini-router';

export type PdfDocumentStatus = 'TEXT_PDF' | 'SCANNED_UNSUPPORTED' | 'ENCRYPTED_OR_UNREADABLE';

interface PdfResult {
  documentStatus: PdfDocumentStatus;
  pageCount: number | null;
  candidates: Array<{
    candidateKey: string;
    term: string;
    translation: string;
    definition: string | null;
    partOfSpeech: string | null;
    context: string | null;
    pageNumber: number | null;
    confidence: number;
    usefulness: number;
    cefrLevel: LearnerLevel | null;
    isVisuallyConcrete: boolean | null;
  }>;
}

export interface PdfExtraction {
  candidates: NormalizedImportCandidate[];
  pageCount: number | null;
  model: string;
  fallbackCount: number;
  attempts: GeminiAttempt[];
  usage?: GeminiUsage;
}

export const PDF_CANDIDATE_LIMIT = IMPORT_POLICY.pdf.maxCandidates;

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const clean = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;
  return JSON.parse(clean);
}

function score(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : null;
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

function parsePdfResult(text: string): PdfResult {
  const parsed = parseJson(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('PDF_INVALID_MODEL_OUTPUT');
  const record = parsed as Record<string, unknown>;
  const documentStatus = record.documentStatus;
  if (!['TEXT_PDF', 'SCANNED_UNSUPPORTED', 'ENCRYPTED_OR_UNREADABLE'].includes(String(documentStatus))) {
    throw new Error('PDF_INVALID_MODEL_OUTPUT');
  }
  const rawCandidates = Array.isArray(record.candidates) ? record.candidates : [];
  const candidates: PdfResult['candidates'] = [];
  for (const item of rawCandidates) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.term !== 'string' || typeof row.translation !== 'string') continue;
    const confidence = score(row.confidence);
    const usefulness = score(row.usefulness);
    if (confidence === null || usefulness === null) continue;
    const pageNumber = typeof row.pageNumber === 'number' && Number.isInteger(row.pageNumber) && row.pageNumber > 0
      ? row.pageNumber
      : null;
    candidates.push({
      candidateKey: typeof row.candidateKey === 'string' ? row.candidateKey.trim() : '',
      term: row.term,
      translation: row.translation,
      definition: nullableText(row.definition),
      partOfSpeech: nullableText(row.partOfSpeech),
      context: nullableText(row.context),
      pageNumber,
      confidence,
      usefulness,
      cefrLevel: isLearnerLevel(row.cefrLevel) ? row.cefrLevel : null,
      isVisuallyConcrete: typeof row.isVisuallyConcrete === 'boolean' ? row.isVisuallyConcrete : null,
    });
    if (candidates.length >= PDF_CANDIDATE_LIMIT) break;
  }
  return {
    documentStatus: String(documentStatus) as PdfDocumentStatus,
    pageCount: typeof record.pageCount === 'number' && Number.isInteger(record.pageCount) && record.pageCount > 0
      ? record.pageCount
      : null,
    candidates,
  };
}

function normalizedResult(result: PdfResult, objectKey: string): NormalizedImportCandidate[] {
  if (result.documentStatus === 'SCANNED_UNSUPPORTED') throw new Error('PDF_SCANNED_UNSUPPORTED');
  if (result.documentStatus === 'ENCRYPTED_OR_UNREADABLE') throw new Error('PDF_ENCRYPTED_OR_UNREADABLE');
  const seen = new Set<string>();
  const output: NormalizedImportCandidate[] = [];
  for (const row of result.candidates) {
    const term = row.term.trim().replace(/\s+/g, ' ');
    const translation = row.translation.trim().replace(/\s+/g, ' ');
    if (!term || !translation) continue;
    const identity = `${term.toLocaleLowerCase()}\u0000${translation.toLocaleLowerCase()}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    output.push({
      candidateKey: row.candidateKey || `pdf-${output.length + 1}`,
      term,
      translation,
      definition: row.definition,
      partOfSpeech: row.partOfSpeech,
      context: row.context,
      occurrence: {
        sentence: row.context,
        sourceUri: `neon-object://${IMPORT_BUCKET}/${objectKey}`,
        locator: row.pageNumber === null ? null : `page:${row.pageNumber}`,
        pageNumber: row.pageNumber,
        timestampSeconds: null,
      },
      confidence: row.confidence,
      usefulness: row.usefulness,
      cefrLevel: row.cefrLevel,
      duplicateHint: null,
      isVisuallyConcrete: row.isVisuallyConcrete,
    });
  }
  if (!output.length) throw new Error('PDF_NO_CANDIDATES');
  return output;
}

export async function extractPdfVocabulary(input: {
  objectKey: string;
  targetLanguageCode: string;
  referenceLanguageCode: string;
  learnerLevel: LearnerLevel;
}): Promise<PdfExtraction> {
  const fileUrl = await createImportReadUrl(input.objectKey);
  const system = 'You are a conservative vocabulary curator. Inspect only the supplied PDF URL. Output machine-readable JSON only and prefer precision over candidate count.';
  const prompt = [
    `Open and analyze this PDF URL: ${fileUrl}`,
    'Treat this as a text-PDF import first.',
    'If the document is primarily scanned images without a usable text layer, set documentStatus to SCANNED_UNSUPPORTED and return no candidates.',
    'If it is encrypted, inaccessible, malformed, or unreadable, set documentStatus to ENCRYPTED_OR_UNREADABLE and return no candidates.',
    `Vocabulary is in ${input.targetLanguageCode}; meanings/translations must be in ${input.referenceLanguageCode}.`,
    `The learner is approximately CEFR ${input.learnerLevel}; prefer useful vocabulary around that level and up to one level above without discarding contextually important phrases.`,
    `Return at most ${PDF_CANDIDATE_LIMIT} high-value words or multi-word phrases, not every token.`,
    'For long documents, inspect representative sections across the document, consolidate repeated vocabulary globally, and keep the best representative occurrence.',
    'Use the sense from the cited page context. Preserve multi-word expressions.',
    'pageNumber must be the correct 1-based PDF page for the representative occurrence when it can be verified; otherwise use null.',
    'Context must be a short exact or minimally normalized sentence from that page when confidently available; otherwise null.',
    'cefrLevel must be A1, A2, B1, B2, C1, C2, or null when uncertain.',
    'Never invent page numbers or quotations. Lower confidence when uncertain.',
    'Return JSON only, no Markdown, in this shape:',
    '{"documentStatus":"TEXT_PDF","pageCount":12,"candidates":[{"candidateKey":"...","term":"...","translation":"...","definition":null,"partOfSpeech":null,"context":null,"pageNumber":3,"confidence":0.9,"usefulness":0.9,"cefrLevel":"B1","isVisuallyConcrete":null}]}',
  ].join('\n');

  const routed = await routeGeminiContent({
    apiKey: process.env.GEMINI_API_KEY,
    system,
    parts: [{ text: prompt }],
    tools: [{ url_context: {} }],
    task: 'vocabulary_pdf_import',
    models: GEMINI_URL_MODEL_CHAIN,
    maxOutputTokens: 3_600,
    attemptTimeoutMs: 20_000,
    overallTimeoutMs: 44_000,
  });

  if (!routed.ok) {
    if (routed.error === 'missing-api-key') throw new Error('AI_IMPORT_NOT_CONFIGURED');
    if (routed.error === 'provider-rejected-request') {
      if ([400, 403, 404].includes(routed.status ?? 0)) throw new Error('PDF_ENCRYPTED_OR_UNREADABLE');
      throw new Error(`PDF_PROVIDER_REJECTED:${routed.status ?? 'unknown'}`);
    }
    throw new Error('PDF_PROVIDER_UNAVAILABLE');
  }

  const parsed = parsePdfResult(routed.text);
  return {
    candidates: normalizedResult(parsed, input.objectKey),
    pageCount: parsed.pageCount,
    model: routed.model,
    fallbackCount: routed.fallbackCount,
    attempts: routed.attempts,
    ...(routed.usage ? { usage: routed.usage } : {}),
  };
}
