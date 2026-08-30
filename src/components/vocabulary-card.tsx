import { useEffect } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { StudyCard } from '@/domain/types';
import { colors, motion, radius, spacing, typography } from '@/theme/tokens';
import { useReducedMotion } from '@/utils/use-reduced-motion';
import { PronunciationButton } from './pronunciation-button';
import { Surface } from './primitives';

export function VocabularyCard({ card, revealed, onReveal }: { card: StudyCard; revealed: boolean; onReveal: () => void }) {
  const progress = useSharedValue(revealed ? 1 : 0);
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const cardHeight = Math.min(500, Math.max(330, height * 0.5));

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
      accessibilityLabel={revealed ? `${card.term}. المعنى: ${card.translation}` : `${card.term}. دوس عشان تشوف المعنى.`}
      accessibilityHint={revealed ? 'اسحب يمين لو عارفها أو شمال لو نسيتها.' : 'بيظهر المعنى والمثال.'}
      onPress={() => !revealed && onReveal()}
      style={{ width: '100%', height: cardHeight }}
    >
      <Animated.View style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backfaceVisibility: 'hidden' }, frontStyle]}>
        <Surface style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <View style={{ gap: spacing.lg, alignItems: 'center', width: '100%' }}>
            <Text selectable adjustsFontSizeToFit minimumFontScale={0.55} numberOfLines={3} style={{ color: colors.ink, fontSize: typography.display, lineHeight: 56, fontWeight: '900', textAlign: 'center' }}>
              {card.term}
            </Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, textAlign: 'center', writingDirection: 'rtl' }}>دوس بس لو محتاج تشوف المعنى</Text>
          </View>
        </Surface>
      </Animated.View>

      <Animated.View pointerEvents={revealed ? 'auto' : 'none'} style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backfaceVisibility: 'hidden' }, backStyle]}>
        <Surface style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <View style={{ gap: spacing.lg, alignItems: 'stretch' }}>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontWeight: '800', textAlign: 'center' }}>{card.term}</Text>
            <Text selectable style={{ color: colors.ink, fontSize: 36, lineHeight: 48, fontWeight: '900', textAlign: 'center', writingDirection: card.referenceLanguageCode === 'ar' ? 'rtl' : 'ltr' }}>
              {card.translation}
            </Text>
            <View style={{ alignItems: 'center' }}><PronunciationButton uri={card.audioUri} compact /></View>
            {card.contextSentence ? (
              <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, borderCurve: 'continuous', padding: spacing.md }}>
                <Text selectable style={{ color: colors.ink, fontSize: typography.body, lineHeight: 26, textAlign: 'center' }}>“{card.contextSentence}”</Text>
              </View>
            ) : null}
          </View>
        </Surface>
      </Animated.View>
    </Pressable>
  );
}
