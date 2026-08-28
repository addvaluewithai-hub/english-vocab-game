import { describe, expect, it } from 'vitest';
import {
  MAX_LIST_CANDIDATES,
  MAX_TEXT_CANDIDATES,
  normalizeAiTextCandidates,
  parseExplicitVocabularyList,
  textSourceFingerprint,
  validatePastedText,
} from '@/imports/text-parser';

describe('text imports', () => {
  it('parses explicit vocabulary lists while preserving phrases', () => {
    const candidates = parseExplicitVocabularyList([
      '1. look forward to — يتطلع إلى',
      'reliable - موثوق',
      'carry on: يستمر',
    ].join('\n'));
    expect(candidates.map((item) => item.term)).toEqual(['look forward to', 'reliable', 'carry on']);
    expect(candidates[0]?.translation).toBe('يتطلع إلى');
    expect(candidates.every((item) => item.confidence === 0.99)).toBe(true);
    expect(candidates.every((item) => item.cefrLevel === null)).toBe(true);
  });

  it('does not mistake normal prose for a vocabulary list', () => {
    const paragraph = 'I look forward to seeing you tomorrow. This reliable little car has been surprisingly useful.';
    expect(parseExplicitVocabularyList(paragraph)).toEqual([]);
  });

  it('deduplicates repeated list entries and enforces a bounded list size', () => {
    const lines = Array.from({ length: MAX_LIST_CANDIDATES + 20 }, (_, index) => `term ${index} — meaning ${index}`);
    lines.unshift('term 0 — meaning 0');
    const candidates = parseExplicitVocabularyList(lines.join('\n'));
    expect(candidates).toHaveLength(MAX_LIST_CANDIDATES);
    expect(new Set(candidates.map((item) => item.candidateKey)).size).toBe(MAX_LIST_CANDIDATES);
  });

  it('normalizes AI candidates, removes duplicates, clamps scores, and caps output', () => {
    const rows = Array.from({ length: MAX_TEXT_CANDIDATES + 10 }, (_, index) => ({
      term: `  phrase ${index}  `,
      translation: ` meaning ${index} `,
      definition: null,
      partOfSpeech: ' phrase ',
      context: `Context ${index}.`,
      confidence: index === 0 ? 2 : 0.8,
      usefulness: index === 0 ? -1 : 0.7,
      cefrLevel: index === 0 ? 'B2' as const : 'B1' as const,
      isVisuallyConcrete: false,
    }));
    rows.splice(1, 0, { ...rows[0]! });
    const candidates = normalizeAiTextCandidates(rows);
    expect(candidates).toHaveLength(MAX_TEXT_CANDIDATES);
    expect(candidates[0]).toMatchObject({ term: 'phrase 0', confidence: 1, usefulness: 0, cefrLevel: 'B2' });
    expect(candidates[0]?.occurrence.sentence).toBe('Context 0.');
  });

  it('creates stable fingerprints from equivalent whitespace/casing', () => {
    expect(textSourceFingerprint(' Hello   WORLD ')).toBe(textSourceFingerprint('hello world'));
  });

  it('rejects empty and oversized pasted sources before expensive work', () => {
    expect(() => validatePastedText('   ')).toThrow('Paste some text');
    expect(() => validatePastedText('x'.repeat(12_001))).toThrow('limited to');
  });
});
