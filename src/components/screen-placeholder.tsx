import { ScrollView, Text } from 'react-native';
import { colors, spacing, typography } from '@/theme/tokens';

export function ScreenPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Text selectable style={{ fontSize: typography.title, fontWeight: '800', color: colors.ink }}>{title}</Text>
      <Text selectable style={{ fontSize: typography.body, lineHeight: 25, color: colors.inkMuted }}>{body}</Text>
    </ScrollView>
  );
}
