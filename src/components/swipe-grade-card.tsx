import type { ReactNode } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { ReviewGrade } from '@/domain/types';
import { colors, motion, spacing, typography } from '@/theme/tokens';
import { useReducedMotion } from '@/utils/use-reduced-motion';

async function hapticForGrade(grade: ReviewGrade) {
  if (process.env.EXPO_OS !== 'ios') return;
  await Haptics.notificationAsync(
    grade === 'KNEW'
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Warning,
  );
}

export function SwipeGradeCard({
  children,
  disabled,
  onGrade,
}: {
  children: ReactNode;
  disabled: boolean;
  onGrade: (grade: ReviewGrade) => void;
}) {
  const translateX = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const exitDistance = width * 1.25;

  const finishGrade = (grade: ReviewGrade) => {
    void hapticForGrade(grade);
    onGrade(grade);
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-8, 8])
    .failOffsetY([-28, 28])
    .shouldCancelWhenOutside(false)
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      const committed = Math.abs(event.translationX) >= motion.swipeThreshold || Math.abs(event.velocityX) >= 650;
      if (!committed) {
        translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
        return;
      }

      const grade: ReviewGrade = event.translationX > 0 || event.velocityX > 0 ? 'KNEW' : 'FORGOT';
      const destination = grade === 'KNEW' ? exitDistance : -exitDistance;
      translateX.value = reducedMotion
        ? destination
        : withTiming(destination, { duration: motion.quick });
      runOnJS(finishGrade)(grade);
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      {
        rotateZ: `${interpolate(
          translateX.value,
          [-width, 0, width],
          [-9, 0, 9],
        )}deg`,
      },
    ],
  }));
  const forgotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-120, -30, 0], [1, 0.15, 0]),
  }));
  const knewStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 30, 120], [0, 0.15, 1]),
  }));

  return (
    <View style={{ width: '100%' }}>
      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          {children}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: spacing.lg,
                top: spacing.lg,
                backgroundColor: colors.dangerSurface,
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 999,
              },
              forgotStyle,
            ]}
          >
            <Text selectable style={{ color: colors.danger, fontSize: typography.label, fontWeight: '900' }}>
              STUDY AGAIN ↻
            </Text>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                right: spacing.lg,
                top: spacing.lg,
                backgroundColor: colors.successSurface,
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 999,
              },
              knewStyle,
            ]}
          >
            <Text selectable style={{ color: colors.success, fontSize: typography.label, fontWeight: '900' }}>
              I KNEW IT ✓
            </Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
