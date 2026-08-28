import type { TermKind } from '@/domain/types';

export type EnrichmentKind = 'IMAGE' | 'AUDIO' | 'CONTEXT' | 'EXPLANATION' | 'EXAMPLE';
export type EnrichmentProvenance = 'USER' | 'RULE_ENGINE' | 'IMPORTED' | 'GENERATED';

export interface EnrichmentSubject {
  termKind: TermKind;
  partOfSpeech: string | null;
  definition: string | null;
  contextSentence: string | null;
  imageUri: string | null;
  audioUri: string | null;
}

export interface EnrichmentRecommendation {
  kind: EnrichmentKind;
  priority: 1 | 2 | 3;
  reason: string;
  provenance: 'RULE_ENGINE';
}

const ABSTRACT_POS = new Set(['conjunction', 'preposition', 'determiner', 'pronoun', 'particle', 'auxiliary']);

function add(
  list: EnrichmentRecommendation[],
  kind: EnrichmentKind,
  priority: 1 | 2 | 3,
  reason: string,
): void {
  if (list.some((item) => item.kind === kind)) return;
  list.push({ kind, priority, reason, provenance: 'RULE_ENGINE' });
}

export function recommendEnrichment(card: EnrichmentSubject): EnrichmentRecommendation[] {
  const list: EnrichmentRecommendation[] = [];
  const partOfSpeech = card.partOfSpeech?.trim().toLowerCase() ?? '';
  const hasContext = Boolean(card.contextSentence?.trim());
  const hasExplanation = Boolean(card.definition?.trim());
  const hasImage = Boolean(card.imageUri?.trim());
  const hasAudio = Boolean(card.audioUri?.trim());

  if (card.termKind === 'PHRASE') {
    if (!hasContext) add(list, 'CONTEXT', 1, 'Phrases are easier to remember inside a natural sentence.');
    if (!hasExplanation) add(list, 'EXPLANATION', 1, 'A short sense explanation helps prevent literal or wrong-sense recall.');
    if (!hasAudio) add(list, 'AUDIO', 2, 'Phrases benefit from hearing connected pronunciation.');
    return list;
  }

  if (partOfSpeech === 'noun') {
    if (!hasImage) add(list, 'IMAGE', 1, 'Concrete nouns often benefit from a visual cue when the sense is visually representable.');
    if (!hasContext) add(list, 'EXAMPLE', 2, 'An example keeps the noun tied to a useful sense rather than an isolated label.');
    if (!hasAudio) add(list, 'AUDIO', 2, 'Pronunciation reinforces the spoken form without changing the meaning prompt.');
  } else if (partOfSpeech === 'verb') {
    if (!hasContext) add(list, 'CONTEXT', 1, 'Verbs are learned more reliably with argument and tense context.');
    if (!hasAudio) add(list, 'AUDIO', 2, 'Audio helps connect the written verb to its spoken form.');
    if (!hasExplanation) add(list, 'EXPLANATION', 3, 'A concise explanation can distinguish nearby verb senses.');
  } else if (partOfSpeech === 'adjective' || partOfSpeech === 'adverb') {
    if (!hasContext) add(list, 'EXAMPLE', 1, 'Descriptive words are clearer when attached to a situation.');
    if (!hasAudio) add(list, 'AUDIO', 2, 'Audio helps pronunciation without adding visual clutter.');
  } else if (ABSTRACT_POS.has(partOfSpeech)) {
    if (!hasExplanation) add(list, 'EXPLANATION', 1, 'Function and abstract words usually need a short usage explanation more than an image.');
    if (!hasContext) add(list, 'CONTEXT', 1, 'Context shows how this abstract word behaves in a real sentence.');
    if (!hasAudio) add(list, 'AUDIO', 3, 'Audio is useful when pronunciation or connected speech matters.');
  } else {
    if (!hasContext) add(list, 'CONTEXT', 2, 'A sentence anchors the selected sense.');
    if (!hasAudio) add(list, 'AUDIO', 2, 'Pronunciation is useful when available, but should not block study.');
    if (!hasExplanation) add(list, 'EXPLANATION', 3, 'A concise explanation can disambiguate the selected sense.');
  }

  return list.sort((a, b) => a.priority - b.priority || a.kind.localeCompare(b.kind));
}
