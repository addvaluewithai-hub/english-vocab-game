import type { ReviewMode, StudyCard } from '@/domain/types';

function normalizeAnswer(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function clozeSentence(card: StudyCard): string | null {
  if (!card.contextSentence) return null;
  const escaped = card.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`\\b${escaped}\\b`, 'iu');
  if (!matcher.test(card.contextSentence)) return null;
  return card.contextSentence.replace(matcher, '_____');
}

export function availableRecallModes(card: StudyCard): ReviewMode[] {
  const modes: ReviewMode[] = ['TARGET_TO_MEANING', 'MEANING_TO_TARGET'];
  if (clozeSentence(card)) modes.push('CLOZE');
  if (card.audioUri) modes.push('LISTENING');
  modes.push('TYPING');
  return modes;
}

export function selectRecallMode(card: StudyCard): ReviewMode {
  const modes = availableRecallModes(card);
  const repetitions = Math.max(0, card.state?.repetitions ?? 0);
  return modes[repetitions % modes.length] ?? 'TARGET_TO_MEANING';
}

export function promptForMode(card: StudyCard, mode: ReviewMode): string {
  switch (mode) {
    case 'TARGET_TO_MEANING': return card.term;
    case 'MEANING_TO_TARGET':
    case 'TYPING': return card.translation;
    case 'CLOZE': return clozeSentence(card) ?? card.term;
    case 'LISTENING': return 'Listen, then recall the word or phrase';
  }
}

export function answerForMode(card: StudyCard, mode: ReviewMode): string {
  return mode === 'TARGET_TO_MEANING' ? card.translation : card.term;
}

export function gradeTypedAnswer(card: StudyCard, answer: string): boolean {
  return normalizeAnswer(answer) === normalizeAnswer(card.term);
}
