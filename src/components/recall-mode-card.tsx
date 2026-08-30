import { Text, TextInput, View } from 'react-native';
import type { ReviewMode, StudyCard } from '@/domain/types';
import { answerForMode, promptForMode } from '@/study/recall-modes';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { PronunciationButton } from './pronunciation-button';
import { ActionButton, Chip, Surface } from './primitives';

const MODE_LABEL: Record<ReviewMode, string> = {
  TARGET_TO_MEANING: 'المعنى',
  MEANING_TO_TARGET: 'العكس',
  CLOZE: 'السياق',
  LISTENING: 'اسمع',
  TYPING: 'اكتب',
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
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, textAlign: 'center', writingDirection: 'rtl' }}>{prompt}</Text>
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
            accessibilityLabel="اكتب الكلمة أو العبارة"
            value={typedAnswer}
            onChangeText={onTypedAnswer}
            onSubmitEditing={onSubmitTyping}
            editable={!disabled}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            placeholder="اكتب إجابتك"
            style={{ minHeight: 54, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceMuted, color: colors.ink, fontSize: typography.body }}
          />
          <ActionButton label="راجع الإجابة" disabled={disabled || !typedAnswer.trim()} onPress={onSubmitTyping} />
        </View>
      ) : revealed ? (
        <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: spacing.sm }}>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, writingDirection: 'rtl' }}>الإجابة</Text>
          <Text selectable style={{ color: colors.ink, fontSize: 34, lineHeight: 45, fontWeight: '800', textAlign: 'center' }}>{answer}</Text>
          {mode !== 'MEANING_TO_TARGET' ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, textAlign: 'center', writingDirection: 'rtl' }}>{card.translation}</Text> : null}
        </View>
      ) : <ActionButton label="وريني الإجابة" disabled={disabled} onPress={onReveal} />}
    </Surface>
  );
}
