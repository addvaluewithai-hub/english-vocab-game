import { Text, TextInput, View } from 'react-native';
import type { ReviewMode, StudyCard } from '@/domain/types';
import { answerForMode, promptForMode } from '@/study/recall-modes';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { PronunciationButton } from './pronunciation-button';
import { ActionButton, Chip, Surface } from './primitives';

const MODE_LABEL: Record<ReviewMode, string> = {
  TARGET_TO_MEANING: 'MEANING',
  MEANING_TO_TARGET: 'REVERSE',
  CLOZE: 'CONTEXT',
  LISTENING: 'LISTEN',
  TYPING: 'TYPE',
};

export function RecallModeCard({
  card,
  mode,
  revealed,
  typedAnswer,
  disabled,
  onTypedAnswer,
  onReveal,
  onSubmitTyping,
}: {
  card: StudyCard;
  mode: Exclude<ReviewMode, 'TARGET_TO_MEANING'>;
  revealed: boolean;
  typedAnswer: string;
  disabled: boolean;
  onTypedAnswer: (value: string) => void;
  onReveal: () => void;
  onSubmitTyping: () => void;
}) {
  const prompt = promptForMode(card, mode);
  const answer = answerForMode(card, mode);

  return (
    <Surface style={{ minHeight: 390, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg }}>
      <View style={{ alignItems: 'center' }}><Chip>{MODE_LABEL[mode]}</Chip></View>
      {mode === 'LISTENING' ? (
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, textAlign: 'center' }}>{prompt}</Text>
          <PronunciationButton uri={card.audioUri} compact />
        </View>
      ) : (
        <Text selectable style={{ color: colors.ink, fontSize: mode === 'CLOZE' ? 28 : 38, lineHeight: mode === 'CLOZE' ? 39 : 49, fontWeight: '800', textAlign: 'center', writingDirection: card.referenceLanguageCode === 'ar' && mode !== 'CLOZE' ? 'rtl' : 'auto' }}>
          {prompt}
        </Text>
      )}

      {mode === 'TYPING' ? (
        <View style={{ gap: spacing.sm }}>
          <TextInput
            accessibilityLabel="Type the word or phrase"
            value={typedAnswer}
            onChangeText={onTypedAnswer}
            onSubmitEditing={onSubmitTyping}
            editable={!disabled}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            placeholder="Type your answer"
            style={{ minHeight: 54, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceMuted, color: colors.ink, fontSize: typography.body }}
          />
          <ActionButton label="Check answer" disabled={disabled || !typedAnswer.trim()} onPress={onSubmitTyping} />
        </View>
      ) : revealed ? (
        <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: spacing.sm }}>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label }}>Answer</Text>
          <Text selectable style={{ color: colors.ink, fontSize: 34, lineHeight: 45, fontWeight: '800', textAlign: 'center' }}>{answer}</Text>
          {mode !== 'MEANING_TO_TARGET' ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, textAlign: 'center' }}>{card.translation}</Text> : null}
        </View>
      ) : <ActionButton label="Reveal answer" disabled={disabled} onPress={onReveal} />}
    </Surface>
  );
}
