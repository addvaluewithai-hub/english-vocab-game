import type { NormalizedImportCandidate } from './contracts';
import { isLearnerLevel, type LearnerLevel } from './ranking';

export const MAX_PASTED_TEXT_CHARS = 12_000;
export const MAX_TEXT_CANDIDATES = 24;
export const MAX_LIST_CANDIDATES = 60;

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function stripListPrefix(value: string): string {
  return value.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '');
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function splitListLine(line: string): [string, string] | null {
  const cleaned = stripListPrefix(line).trim();
  if (!cleaned) return null;
  const separators = [/\s+—\s+/, /\s+–\s+/, /\s+-\s+/, /\t+/, /\s*=\s*/, /\s*:\s+/];
  for (const separator of separators) {
    const match = separator.exec(cleaned);
    if (!match || match.index <= 0) continue;
    const left = normalizeWhitespace(cleaned.slice(0, match.index));
    const right = normalizeWhitespace(cleaned.slice(match.index + match[0].length));
    if (!left || !right || left.length > 100 || right.length > 240) continue;
    return [left, right];
  }
  return null;
}

export function textSourceFingerprint(text: string): string {
  return `text:${stableHash(normalizeWhitespace(text).toLocaleLowerCase())}`;
}

export function parseExplicitVocabularyList(text: string): NormalizedImportCandidate[] {
  const rawLines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rawLines.length === 0) return [];

  const parsed = rawLines.map(splitListLine);
  const matches = parsed.filter((item): item is [string, string] => item !== null);
  const requiredMatches = rawLines.length === 1 ? 1 : Math.max(2, Math.ceil(rawLines.length * 0.6));
  if (matches.length < requiredMatches) return [];

  const seen = new Set<string>();
  const candidates: NormalizedImportCandidate[] = [];
  for (const [term, translation] of matches) {
    const identity = `${term.toLocaleLowerCase()}\u0000${translation.toLocaleLowerCase()}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    candidates.push({
      candidateKey: `list-${stableHash(identity)}`,
      term,
      translation,
      definition: null,
      partOfSpeech: null,
      context: null,
      occurrence: {
        sentence: null,
        sourceUri: null,
        locator: null,
        pageNumber: null,
        timestampSeconds: null,
      },
      confidence: 0.99,
      usefulness: 0.75,
      cefrLevel: null,
      duplicateHint: null,
      isVisuallyConcrete: null,
    });
    if (candidates.length >= MAX_LIST_CANDIDATES) break;
  }
  return candidates;
}

export function isLikelyVocabularyList(text: string): boolean {
  return parseExplicitVocabularyList(text).length > 0;
}

export function validatePastedText(text: string): string {
  const normalized = text.trim();
  if (!normalized) throw new Error('Paste some text or a vocabulary list first.');
  if (normalized.length > MAX_PASTED_TEXT_CHARS) {
    throw new Error(`Pasted text is limited to ${MAX_PASTED_TEXT_CHARS.toLocaleString()} characters per import.`);
  }
  return normalized;
}

export function normalizeAiTextCandidates(
  rows: Array<{
    term: string;
    translation: string;
    definition: string | null;
    partOfSpeech: string | null;
    context: string | null;
    confidence: number;
    usefulness: number;
    cefrLevel: LearnerLevel | null;
    isVisuallyConcrete: boolean | null;
  }>,
): NormalizedImportCandidate[] {
  const seen = new Set<string>();
  const output: NormalizedImportCandidate[] = [];
  for (const row of rows) {
    const term = normalizeWhitespace(row.term);
    const translation = normalizeWhitespace(row.translation);
    if (!term || !translation) continue;
    const identity = `${term.toLocaleLowerCase()}\u0000${translation.toLocaleLowerCase()}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const context = row.context?.trim() || null;
    output.push({
      candidateKey: `prose-${stableHash(identity)}`,
      term,
      translation,
      definition: row.definition?.trim() || null,
      partOfSpeech: row.partOfSpeech?.trim() || null,
      context,
      occurrence: {
        sentence: context,
        sourceUri: null,
        locator: null,
        pageNumber: null,
        timestampSeconds: null,
      },
      confidence: Math.max(0, Math.min(1, row.confidence)),
      usefulness: Math.max(0, Math.min(1, row.usefulness)),
      cefrLevel: isLearnerLevel(row.cefrLevel) ? row.cefrLevel : null,
      duplicateHint: null,
      isVisuallyConcrete: row.isVisuallyConcrete,
    });
    if (output.length >= MAX_TEXT_CANDIDATES) break;
  }
  return output;
}
