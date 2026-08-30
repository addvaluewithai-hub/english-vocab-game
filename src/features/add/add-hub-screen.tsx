import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Surface } from '@/components/primitives';
import { colors, spacing, typography } from '@/theme/tokens';

const METHODS = [
  {
    title: 'Smart Import',
    eyebrow: 'FASTEST FOR MANY WORDS',
    body: 'Paste text, use images or a PDF, or give Gemini a YouTube or public web URL. Choose the words before they are added.',
    icon: '✨',
    href: '/smart-import' as const,
    dark: true,
  },
  {
    title: 'A1 Course Adventure',
    eyebrow: 'READY-MADE COURSE',
    body: 'Explore 6 worlds and 45 missions, then collect the vocabulary you want to study.',
    icon: '🗺️',
    href: '/course-library' as const,
    dark: false,
  },
  {
    title: 'Quick Add',
    eyebrow: 'ONE WORD OR PHRASE',
    body: 'Type one item yourself and use Gemini to fill the Arabic meaning and natural example.',
    icon: '+',
    href: '/manual-add' as const,
    dark: false,
  },
];

export function AddHubScreen() {
  const router = useRouter();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl }}
      style={{ flex: 1, backgroundColor: colors.canvas }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontWeight: '800' }}>ADD TO YOUR BANK</Text>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: 32, lineHeight: 38, fontWeight: '900' }}>How do you want to add words?</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 24 }}>Pick one path. They all end in the same Vocabulary Bank and Study rounds.</Text>
      </View>

      <View style={{ gap: spacing.md }}>
        {METHODS.map((method) => (
          <Pressable key={method.title} onPress={() => router.push(method.href)} style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
            <Surface style={{ padding: spacing.lg, gap: spacing.md, backgroundColor: method.dark ? colors.ink : colors.surface }}>
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                <View style={{ width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: method.dark ? colors.surface : colors.surfaceMuted }}>
                  <Text aria-hidden style={{ fontSize: method.title === 'Quick Add' ? 34 : 28, fontWeight: '900' }}>{method.icon}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text selectable style={{ color: method.dark ? colors.surfaceMuted : colors.inkMuted, fontSize: typography.small, fontWeight: '900', letterSpacing: 0.7 }}>{method.eyebrow}</Text>
                  <Text selectable style={{ color: method.dark ? colors.surface : colors.ink, fontSize: 22, fontWeight: '900' }}>{method.title}</Text>
                </View>
                <Text aria-hidden style={{ color: method.dark ? colors.surface : colors.ink, fontSize: 26 }}>→</Text>
              </View>
              <Text selectable style={{ color: method.dark ? colors.surfaceMuted : colors.inkMuted, fontSize: typography.label, lineHeight: 21 }}>{method.body}</Text>
            </Surface>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={() => router.push('/import-staging')} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
        <Text selectable style={{ color: colors.accent, fontSize: typography.label, fontWeight: '800', textAlign: 'center' }}>Review pending import candidates →</Text>
      </Pressable>
    </ScrollView>
  );
}
