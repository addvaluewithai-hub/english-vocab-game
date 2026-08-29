import { describe, expect, it } from 'vitest';
import {
  MAX_LIST_CANDIDATES,
  MAX_PASTED_TEXT_CHARS,
  MAX_TEXT_CANDIDATES,
  normalizeAiTextCandidates,
  parseExplicitVocabularyList,
  parseLooseVocabularyList,
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

  it('accepts term-only and mixed lists so AI can fill missing study data', () => {
    const items = parseLooseVocabularyList([
      'resilient',
      '2. look forward to',
      'reliable — موثوق',
      'carry on',
    ].join('\n'));
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.term)).toEqual(['resilient', 'look forward to', 'reliable', 'carry on']);
    expect(items.map((item) => item.translation)).toEqual([null, null, 'موثوق', null]);
  });

  it('accepts compact comma or semicolon term lists', () => {
    expect(parseLooseVocabularyList('resilient, reliable; carry on').map((item) => item.term))
      .toEqual(['resilient', 'reliable', 'carry on']);
  });

  it('does not mistake normal prose for a vocabulary list', () => {
    const paragraph = 'I look forward to seeing you tomorrow. This reliable little car has been surprisingly useful.';
    expect(parseExplicitVocabularyList(paragraph)).toEqual([]);
    expect(parseLooseVocabularyList(paragraph)).toEqual([]);
  });

  it('deduplicates repeated list entries and supports up to two thousand items', () => {
    const lines = Array.from({ length: MAX_LIST_CANDIDATES + 20 }, (_, index) => `term ${index}`);
    lines.unshift('term 0');
    const items = parseLooseVocabularyList(lines.join('\n'));
    expect(items).toHaveLength(MAX_LIST_CANDIDATES);
    expect(new Set(items.map((item) => item.itemKey)).size).toBe(MAX_LIST_CANDIDATES);
  });

  it('keeps same-spelling entries when the user supplied different senses', () => {
    const items = parseLooseVocabularyList('bank — مصرف\nbank — ضفة');
    expect(items).toHaveLength(2);
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

  it('keeps generated list examples separate from source provenance', () => {
    const [candidate] = normalizeAiTextCandidates([{
      term: 'resilient',
      translation: 'مرن',
      definition: null,
      partOfSpeech: 'adjective',
      context: 'She remained resilient after the setback.',
      confidence: 0.9,
      usefulness: 0.9,
      cefrLevel: 'B2',
      isVisuallyConcrete: false,
    }], { contextIsSource: false, candidatePrefix: 'list-ai' });
    expect(candidate?.context).toContain('resilient');
    expect(candidate?.occurrence.sentence).toBeNull();
  });

  it('creates stable fingerprints from equivalent whitespace/casing', () => {
    expect(textSourceFingerprint(' Hello   WORLD ')).toBe(textSourceFingerprint('hello world'));
  });

  it('rejects empty and oversized pasted sources before expensive work', () => {
    expect(() => validatePastedText('   ')).toThrow('Paste some text');
    expect(() => validatePastedText('x'.repeat(MAX_PASTED_TEXT_CHARS + 1))).toThrow('limited to');
  });
});
