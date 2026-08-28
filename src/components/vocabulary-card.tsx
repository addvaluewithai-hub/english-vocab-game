import { useEffect } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { StudyCard } from '@/domain/types';
import { colors, motion, radius, spacing, typography } from '@/theme/tokens';
import { useReducedMotion } from '@/utils/use-reduced-motion';
import { Chip, Surface } from './primitives';

export function VocabularyCard({ card, revealed, onReveal }: { card: StudyCard; revealed: boolean; onReveal: () => void }) {
  const progress = useSharedValue(revealed ? 1 : 0);
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const cardHeight = Math.min(520, Math.max(360, height * 0.53));

  useEffect(() => {
    progress.value = reducedMotion ? (revealed ? 1 : 0) : withTiming(revealed ? 1 : 0, { duration: motion.standard });
  }, [progress, reducedMotion, revealed]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(progress.value, [0, 1], [0, 180])}deg` }],
    opacity: progress.value < 0.5 ? 1 : 0,
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(progress.value, [0, 1], [180, 360])}deg` }],
    opacity: progress.value >= 0.5 ? 1 : 0,
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={revealed ? `${card.term}. Answer revealed: ${card.translation}` : `${card.term}. Double tap to reveal the answer.`}
      accessibilityHint={revealed ? 'Choose Knew it or Forgot below.' : 'Reveals the translation and context.'}
      onPress={() => !revealed && onReveal()}
      style={{ width: '100%', height: cardHeight }}
    >
      <Animated.View style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backfaceVisibility: 'hidden' }, frontStyle]}>
        <Surface style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <View style={{ gap: spacing.md, alignItems: 'center' }}>
            <Chip>{card.termKind === 'PHRASE' ? 'PHRASE' : 'WORD'}</Chip>
            <Text selectable adjustsFontSizeToFit minimumFontScale={0.55} numberOfLines={3} style={{ color: colors.ink, fontSize: typography.display, lineHeight: 54, fontWeight: '800', textAlign: 'center' }}>
              {card.term}
            </Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, textAlign: 'center' }}>Recall the meaning, then tap to reveal</Text>
          </View>
        </Surface>
      </Animated.View>

      <Animated.View pointerEvents={revealed ? 'auto' : 'none'} style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backfaceVisibility: 'hidden' }, backStyle]}>
        <Surface style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {card.partOfSpeech ? <Chip>{card.partOfSpeech}</Chip> : null}
              {card.sourceTitle ? <Chip>{card.sourceTitle}</Chip> : null}
            </View>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontWeight: '700' }}>{card.term}</Text>
            <Text selectable style={{ color: colors.ink, fontSize: 34, lineHeight: 46, fontWeight: '800', textAlign: card.referenceLanguageCode === 'ar' ? 'right' : 'left', writingDirection: card.referenceLanguageCode === 'ar' ? 'rtl' : 'ltr' }}>
              {card.translation}
            </Text>
            {card.definition ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25 }}>{card.definition}</Text> : null}
            {card.contextSentence ? (
              <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.md, borderCurve: 'continuous', padding: spacing.md }}>
                <Text selectable style={{ color: colors.ink, fontSize: typography.body, lineHeight: 25 }}>“{card.contextSentence}”</Text>
              </View>
            ) : null}
            {card.note ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 20 }}>Note: {card.note}</Text> : null}
          </View>
        </Surface>
      </Animated.View>
    </Pressable>
  );
}
