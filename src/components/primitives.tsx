import type { PropsWithChildren, ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function Surface({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: colors.border,
          boxShadow: '0 12px 30px rgba(30, 32, 28, 0.08)',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type SemanticTone = 'neutral' | 'success' | 'danger';

type ActionButtonProps = PressableProps & {
  label: string;
  tone?: SemanticTone;
  leading?: ReactNode;
};

function semanticColors(tone: SemanticTone) {
  if (tone === 'success') {
    return { background: colors.successSurface, foreground: colors.success };
  }
  if (tone === 'danger') {
    return { background: colors.dangerSurface, foreground: colors.danger };
  }
  return { background: colors.accent, foreground: colors.surface };
}

export function ActionButton({
  label,
  tone = 'neutral',
  leading,
  disabled,
  ...props
}: ActionButtonProps) {
  const palette = semanticColors(tone);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...props}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        backgroundColor: palette.background,
        opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
      })}
    >
      {leading}
      <Text
        selectable
        style={{
          color: palette.foreground,
          fontSize: typography.body,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  accessibilityLabel,
  children,
  disabled,
  ...props
}: PropsWithChildren<PressableProps & { accessibilityLabel: string }>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      {...props}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceMuted,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

export function Chip({ children }: PropsWithChildren) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radius.pill,
      }}
    >
      <Text
        selectable
        style={{
          color: colors.inkMuted,
          fontSize: typography.small,
          fontWeight: '700',
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: PropsWithChildren<{ tone?: SemanticTone }>) {
  const palette =
    tone === 'neutral'
      ? { background: colors.surfaceMuted, foreground: colors.inkMuted }
      : semanticColors(tone);

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: palette.background,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.pill,
      }}
    >
      <Text
        selectable
        style={{
          color: palette.foreground,
          fontSize: typography.small,
          fontWeight: '800',
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function FeedbackLabel({
  tone,
  children,
}: PropsWithChildren<{ tone: Exclude<SemanticTone, 'neutral'> }>) {
  const palette = semanticColors(tone);
  const symbol = tone === 'success' ? '✓' : '↻';

  return (
    <View
      accessibilityRole="text"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: palette.background,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radius.pill,
      }}
    >
      <Text
        selectable
        style={{ color: palette.foreground, fontSize: typography.label, fontWeight: '900' }}
      >
        {symbol} {children}
      </Text>
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height: 6,
        width: '100%',
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          backgroundColor: colors.accent,
          borderRadius: radius.pill,
        }}
      />
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        padding: spacing.xl,
      }}
    >
      <Text
        selectable
        style={{
          color: colors.ink,
          fontSize: typography.title,
          fontWeight: '800',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        selectable
        style={{
          color: colors.inkMuted,
          fontSize: typography.body,
          lineHeight: 25,
          textAlign: 'center',
          maxWidth: 360,
        }}
      >
        {body}
      </Text>
      {action}
    </View>
  );
}

export function AppModal({
  visible,
  title,
  onRequestClose,
  children,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  onRequestClose: () => void;
}>) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(23, 25, 21, 0.38)',
        }}
      >
        <Surface
          style={{
            maxHeight: '82%',
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            paddingTop: spacing.lg,
          }}
        >
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing.md,
              }}
            >
              <Text
                selectable
                accessibilityRole="header"
                style={{
                  flex: 1,
                  color: colors.ink,
                  fontSize: typography.title,
                  fontWeight: '800',
                }}
              >
                {title}
              </Text>
              <IconButton accessibilityLabel="Close" onPress={onRequestClose}>
                <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: '700' }}>
                  ×
                </Text>
              </IconButton>
            </View>
            {children}
          </ScrollView>
        </Surface>
      </View>
    </Modal>
  );
}
