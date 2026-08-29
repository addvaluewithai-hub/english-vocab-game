import type { NormalizedImportCandidate } from './contracts';
import { IMPORT_POLICY } from './policy';
import { isLearnerLevel, type LearnerLevel } from './ranking';

export const MAX_PASTED_TEXT_CHARS = IMPORT_POLICY.text.maxCharacters;
export const MAX_TEXT_CANDIDATES = IMPORT_POLICY.text.maxCandidates;
export const MAX_LIST_CANDIDATES = IMPORT_POLICY.text.maxListCandidates;
export const AI_LIST_BATCH_SIZE = IMPORT_POLICY.text.aiListBatchSize;

export interface ParsedVocabularyListItem {
  itemKey: string;
  term: string;
  translation: string | null;
}

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
    if (!left || !right || left.length > 120 || right.length > 300) continue;
    return [left, right];
  }
  return null;
}

function looksLikeTermOnly(value: string): boolean {
  const cleaned = normalizeWhitespace(stripListPrefix(value));
  if (!cleaned || cleaned.length > 120) return false;
  if (/[.!?](?:\s|$)/.test(cleaned)) return false;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > 12) return false;
  return true;
}

function rawListSegments(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  const only = lines[0] ?? '';
  if (!only) return [];
  const commaParts = only.split(/\s*[;,]\s*/).map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2 && commaParts.every(looksLikeTermOnly)) return commaParts;
  return [only];
}

export function textSourceFingerprint(text: string): string {
  return `text:${stableHash(normalizeWhitespace(text).toLocaleLowerCase())}`;
}

export function parseLooseVocabularyList(text: string): ParsedVocabularyListItem[] {
  const rawSegments = rawListSegments(text);
  if (rawSegments.length === 0) return [];

  const parsed = rawSegments.map((segment) => {
    const explicit = splitListLine(segment);
    if (explicit) {
      const [term, translation] = explicit;
      return { term, translation };
    }
    if (!looksLikeTermOnly(segment)) return null;
    return { term: normalizeWhitespace(stripListPrefix(segment)), translation: null };
  });

  const matches = parsed.filter((item): item is { term: string; translation: string | null } => item !== null);
  const requiredMatches = rawSegments.length === 1 ? 1 : Math.max(2, Math.ceil(rawSegments.length * 0.7));
  if (matches.length < requiredMatches) return [];

  const seen = new Set<string>();
  const items: ParsedVocabularyListItem[] = [];
  for (const item of matches) {
    const identity = `${item.term.toLocaleLowerCase()}\u0000${item.translation?.toLocaleLowerCase() ?? ''}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    items.push({
      itemKey: `list-input-${stableHash(identity)}`,
      term: item.term,
      translation: item.translation,
    });
    if (items.length >= MAX_LIST_CANDIDATES) break;
  }
  return items;
}

function knownListCandidate(item: ParsedVocabularyListItem): NormalizedImportCandidate | null {
  if (!item.translation) return null;
  const identity = `${item.term.toLocaleLowerCase()}\u0000${item.translation.toLocaleLowerCase()}`;
  return {
    candidateKey: `list-${stableHash(identity)}`,
    term: item.term,
    translation: item.translation,
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
  };
}

export function parseExplicitVocabularyList(text: string): NormalizedImportCandidate[] {
  return parseLooseVocabularyList(text)
    .map(knownListCandidate)
    .filter((candidate): candidate is NormalizedImportCandidate => candidate !== null);
}

export function isLikelyVocabularyList(text: string): boolean {
  return parseLooseVocabularyList(text).length > 0;
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
  rows: {
    term: string;
    translation: string;
    definition: string | null;
    partOfSpeech: string | null;
    context: string | null;
    confidence: number;
    usefulness: number;
    cefrLevel: LearnerLevel | null;
    isVisuallyConcrete: boolean | null;
  }[],
  options: { contextIsSource?: boolean; maxCandidates?: number; candidatePrefix?: string } = {},
): NormalizedImportCandidate[] {
  const contextIsSource = options.contextIsSource ?? true;
  const maxCandidates = options.maxCandidates ?? MAX_TEXT_CANDIDATES;
  const candidatePrefix = options.candidatePrefix ?? 'prose';
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
      candidateKey: `${candidatePrefix}-${stableHash(identity)}`,
      term,
      translation,
      definition: row.definition?.trim() || null,
      partOfSpeech: row.partOfSpeech?.trim() || null,
      context,
      occurrence: {
        sentence: contextIsSource ? context : null,
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
    if (output.length >= maxCandidates) break;
  }
  return output;
}
