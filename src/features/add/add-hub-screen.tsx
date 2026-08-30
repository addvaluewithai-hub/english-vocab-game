import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Surface } from '@/components/primitives';
import { colors, spacing, typography } from '@/theme/tokens';

const METHODS = [
  {
    title: 'إضافة ذكية',
    eyebrow: 'أسرع طريقة لكلمات كتير',
    body: 'الصق نص، اختار صور أو PDF، أو حط لينك يوتيوب أو صفحة عامة. Gemini يطلع الكلمات وإنت تختار اللي يعجبك.',
    icon: '✨',
    href: '/smart-import' as const,
    dark: true,
  },
  {
    title: 'مغامرة A1',
    eyebrow: 'كورس جاهز تمشي عليه',
    body: 'لف في 6 عوالم و45 مهمة، واجمع الكلمات والعبارات اللي عايز تذاكرها.',
    icon: '🗺️',
    href: '/course-library' as const,
    dark: false,
  },
  {
    title: 'ضيف بسرعة',
    eyebrow: 'كلمة أو عبارة واحدة',
    body: 'اكتب الكلمة وخلي Gemini يجيب لك المعنى بالعربي ومثال طبيعي عليها.',
    icon: '+',
    href: '/manual-add' as const,
    dark: false,
  },
];

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

export function AddHubScreen() {
  const router = useRouter();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl }}
      style={{ flex: 1, backgroundColor: colors.canvas }}
    >
      <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontWeight: '800', ...rtlText }}>ضيف لبنك كلماتك</Text>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: 32, lineHeight: 40, fontWeight: '900', ...rtlText }}>تحب تضيف الكلمات إزاي؟</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25, ...rtlText }}>اختار الطريقة اللي تناسبك. في الآخر كله بيتجمع في نفس البنك وبيظهر لك في المذاكرة.</Text>
      </View>

      <View style={{ gap: spacing.md }}>
        {METHODS.map((method) => (
          <Pressable key={method.title} onPress={() => router.push(method.href)} style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
            <Surface style={{ padding: spacing.lg, gap: spacing.md, backgroundColor: method.dark ? colors.ink : colors.surface }}>
              <View style={{ flexDirection: 'row-reverse', gap: spacing.md, alignItems: 'center' }}>
                <View style={{ width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: method.dark ? colors.surface : colors.surfaceMuted }}>
                  <Text aria-hidden style={{ fontSize: method.title === 'ضيف بسرعة' ? 34 : 28, fontWeight: '900' }}>{method.icon}</Text>
                </View>
                <View style={{ flex: 1, gap: 4, alignItems: 'flex-end' }}>
                  <Text selectable style={{ color: method.dark ? colors.surfaceMuted : colors.inkMuted, fontSize: typography.small, fontWeight: '900', ...rtlText }}>{method.eyebrow}</Text>
                  <Text selectable style={{ color: method.dark ? colors.surface : colors.ink, fontSize: 22, fontWeight: '900', ...rtlText }}>{method.title}</Text>
                </View>
                <Text aria-hidden style={{ color: method.dark ? colors.surface : colors.ink, fontSize: 26 }}>←</Text>
              </View>
              <Text selectable style={{ color: method.dark ? colors.surfaceMuted : colors.inkMuted, fontSize: typography.label, lineHeight: 22, ...rtlText }}>{method.body}</Text>
            </Surface>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={() => router.push('/import-staging')} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
        <Text selectable style={{ color: colors.accent, fontSize: typography.label, fontWeight: '800', textAlign: 'center', writingDirection: 'rtl' }}>عندك كلمات مستنية المراجعة؟ افتحها ←</Text>
      </Pressable>
    </ScrollView>
  );
}
