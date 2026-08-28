import type { NormalizedImportCandidate } from './contracts';
import { createImportReadUrl, IMPORT_BUCKET } from '@/server/object-storage';

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
    isVisuallyConcrete: boolean | null;
  }>;
}

const PDF_CANDIDATE_LIMIT = 40;

const pdfSchema = {
  type: 'object',
  properties: {
    documentStatus: { type: 'string', enum: ['TEXT_PDF', 'SCANNED_UNSUPPORTED', 'ENCRYPTED_OR_UNREADABLE'] },
    pageCount: { type: ['integer', 'null'], minimum: 1 },
    candidates: {
      type: 'array',
      maxItems: PDF_CANDIDATE_LIMIT,
      items: {
        type: 'object',
        properties: {
          candidateKey: { type: 'string' },
          term: { type: 'string' },
          translation: { type: 'string' },
          definition: { type: ['string', 'null'] },
          partOfSpeech: { type: ['string', 'null'] },
          context: { type: ['string', 'null'] },
          pageNumber: { type: ['integer', 'null'], minimum: 1 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          usefulness: { type: 'number', minimum: 0, maximum: 1 },
          isVisuallyConcrete: { type: ['boolean', 'null'] },
        },
        required: ['candidateKey','term','translation','definition','partOfSpeech','context','pageNumber','confidence','usefulness','isVisuallyConcrete'],
        additionalProperties: false,
      },
    },
  },
  required: ['documentStatus', 'pageCount', 'candidates'],
  additionalProperties: false,
} as const;

function apiKey(): string {
  const value = process.env.OPENAI_API_KEY?.trim();
  if (!value) throw new Error('AI_IMPORT_NOT_CONFIGURED');
  return value;
}

function model(): string {
  return process.env.OPENAI_IMPORT_MODEL?.trim() || 'gpt-5.6-luna';
}

function outputText(body: Record<string, unknown>): string | null {
  if (typeof body.output_text === 'string') return body.output_text;
  if (!Array.isArray(body.output)) return null;
  for (const item of body.output) {
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

function normalizedResult(result: PdfResult, objectKey: string): NormalizedImportCandidate[] {
  if (result.documentStatus === 'SCANNED_UNSUPPORTED') throw new Error('PDF_SCANNED_UNSUPPORTED');
  if (result.documentStatus === 'ENCRYPTED_OR_UNREADABLE') throw new Error('PDF_ENCRYPTED_OR_UNREADABLE');
  const seen = new Set<string>();
  const output: NormalizedImportCandidate[] = [];
  for (const row of result.candidates) {
    const term = row.term.trim().replace(/\s+/g, ' ');
    const translation = row.translation.trim();
    if (!term || !translation) continue;
    const identity = `${term.toLocaleLowerCase()}\u0000${translation.toLocaleLowerCase()}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const pageNumber = row.pageNumber && row.pageNumber > 0 ? row.pageNumber : null;
    output.push({
      candidateKey: row.candidateKey.trim() || `pdf-${output.length + 1}`,
      term,
      translation,
      definition: row.definition?.trim() || null,
      partOfSpeech: row.partOfSpeech?.trim() || null,
      context: row.context?.trim() || null,
      occurrence: {
        sentence: row.context?.trim() || null,
        sourceUri: `neon-object://${IMPORT_BUCKET}/${objectKey}`,
        locator: pageNumber ? `page:${pageNumber}` : null,
        pageNumber,
        timestampSeconds: null,
      },
      confidence: Math.max(0, Math.min(1, row.confidence)),
      usefulness: Math.max(0, Math.min(1, row.usefulness)),
      duplicateHint: null,
      isVisuallyConcrete: row.isVisuallyConcrete,
    });
    if (output.length >= PDF_CANDIDATE_LIMIT) break;
  }
  if (!output.length) throw new Error('PDF_NO_CANDIDATES');
  return output;
}

export async function startPdfExtraction(input: {
  jobId: string;
  objectKey: string;
  targetLanguageCode: string;
  referenceLanguageCode: string;
}): Promise<string> {
  const fileUrl = await createImportReadUrl(input.objectKey);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model(),
      background: true,
      store: true,
      reasoning: { effort: 'low' },
      metadata: { import_job_id: input.jobId, source_type: 'PDF' },
      instructions: [
        'Analyze this PDF for vocabulary learning. Treat this task as text-PDF import first.',
        'If the PDF is primarily scanned images without a usable text layer, return SCANNED_UNSUPPORTED and no candidates.',
        'If encrypted, inaccessible, malformed, or unreadable, return ENCRYPTED_OR_UNREADABLE and no candidates.',
        `Vocabulary is in ${input.targetLanguageCode}; meanings/translations should be in ${input.referenceLanguageCode}.`,
        `Return at most ${PDF_CANDIDATE_LIMIT} high-value words or phrases, not every token.`,
        'For long documents, reason page-range by page-range, consolidate repeated vocabulary globally, and keep the best representative occurrence.',
        'Use the sense from the cited page context. Preserve multi-word expressions. Include a correct 1-based pageNumber whenever possible.',
        'Never invent page numbers or source sentences; use null and lower confidence when uncertain.',
      ].join('\n'),
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: 'Extract a curated vocabulary set with page provenance from this PDF.' },
          { type: 'input_file', file_url: fileUrl, detail: 'auto' },
        ],
      }],
      text: { format: { type: 'json_schema', name: 'pdf_vocabulary_result', strict: true, schema: pdfSchema } },
    }),
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok || typeof body.id !== 'string') {
    const error = body.error && typeof body.error === 'object' ? body.error as Record<string, unknown> : null;
    throw new Error(`PDF_PROVIDER_FAILED:${String(error?.message ?? response.status)}`);
  }
  return body.id;
}

export async function pollPdfExtraction(providerJobId: string, objectKey: string): Promise<{
  status: 'PROCESSING' | 'COMPLETED';
  candidates?: NormalizedImportCandidate[];
  usage?: Record<string, unknown>;
}> {
  const response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(providerJobId)}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`PDF_PROVIDER_POLL_FAILED:${response.status}`);
  const status = String(body.status ?? '');
  if (status === 'queued' || status === 'in_progress') return { status: 'PROCESSING' };
  if (status === 'cancelled') throw new Error('IMPORT_CANCELLED');
  if (status === 'failed' || status === 'incomplete') {
    const error = body.error && typeof body.error === 'object' ? body.error as Record<string, unknown> : null;
    throw new Error(`PDF_PROVIDER_FAILED:${String(error?.message ?? status)}`);
  }
  if (status !== 'completed') return { status: 'PROCESSING' };
  const text = outputText(body);
  if (!text) throw new Error('PDF_PROVIDER_EMPTY');
  const parsed = JSON.parse(text) as PdfResult;
  return {
    status: 'COMPLETED',
    candidates: normalizedResult(parsed, objectKey),
    usage: body.usage && typeof body.usage === 'object' ? body.usage as Record<string, unknown> : undefined,
  };
}

export async function cancelPdfExtraction(providerJobId: string): Promise<void> {
  const response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(providerJobId)}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!response.ok && response.status !== 409) throw new Error(`PDF_PROVIDER_CANCEL_FAILED:${response.status}`);
}
