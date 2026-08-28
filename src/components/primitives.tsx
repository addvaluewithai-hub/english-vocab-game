import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, Text, View, type PressableProps, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function Surface({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
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

type ActionButtonProps = PressableProps & {
  label: string;
  tone?: 'neutral' | 'success' | 'danger';
  leading?: ReactNode;
};

export function ActionButton({ label, tone = 'neutral', leading, disabled, ...props }: ActionButtonProps) {
  const backgroundColor =
    tone === 'success' ? colors.successSurface : tone === 'danger' ? colors.dangerSurface : colors.accent;
  const textColor = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : colors.surface;

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
        backgroundColor,
        opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
      })}
    >
      {leading}
      <Text selectable style={{ color: textColor, fontSize: typography.body, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({ children }: PropsWithChildren) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill }}>
      <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '700' }}>
        {children}
      </Text>
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }} style={{ height: 6, width: '100%', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
      <View style={{ width: `${clamped * 100}%`, height: '100%', backgroundColor: colors.accent, borderRadius: radius.pill }} />
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl }}>
      <Text selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
      <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25, textAlign: 'center', maxWidth: 360 }}>{body}</Text>
      {action}
    </View>
  );
}
