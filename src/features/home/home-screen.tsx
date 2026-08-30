import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { Surface } from '@/components/primitives';

type HomeAction = {
  title: string;
  body: string;
  icon: string;
  href: '/' | '/study' | '/course-library' | '/smart-import' | '/add' | '/manual-add' | '/bank' | '/stats';
  prominent?: boolean;
};

const ACTIONS: HomeAction[] = [
  { title: 'ذاكر دلوقتي', body: 'ابدأ راوند سوايب سريع.', icon: '⚡', href: '/study', prominent: true },
  { title: 'مغامرة A1', body: 'لف في العوالم واجمع الكلمات اللي تهمك.', icon: '🗺️', href: '/course-library' },
  { title: 'إضافة ذكية', body: 'نص، صور، PDF، يوتيوب أو لينك.', icon: '✨', href: '/smart-import' },
  { title: 'ضيف بسرعة', body: 'اكتب كلمة واحدة وخلي Gemini يكملها معاك.', icon: '+', href: '/manual-add' },
  { title: 'كلماتي', body: 'دوّر، عدّل ورتّب الكلمات اللي جمعتها.', icon: '▤', href: '/bank' },
  { title: 'تقدمك', body: 'شوف إنت وصلت لفين في المذاكرة.', icon: '🏆', href: '/stats' },
];

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

export function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl }}
      style={{ flex: 1, backgroundColor: colors.canvas }}
    >
      <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontWeight: '800', ...rtlText }}>VOCAB FLOW</Text>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: 34, lineHeight: 42, fontWeight: '900', ...rtlText }}>عايز تعمل إيه دلوقتي؟</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 26, ...rtlText }}>ذاكر، خد كلمات من الكورس، أو دخل كلمات من عندك. كله بيروح لنفس بنك الكلمات.</Text>
      </View>

      <Pressable onPress={() => router.push('/study')} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
        <Surface style={{ padding: spacing.lg, gap: spacing.md, backgroundColor: colors.ink }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
              <Text aria-hidden style={{ fontSize: 30 }}>⚡</Text>
            </View>
            <View style={{ flex: 1, gap: 4, alignItems: 'flex-end' }}>
              <Text selectable style={{ color: colors.surface, fontSize: 24, fontWeight: '900', ...rtlText }}>ابدأ راوند مذاكرة</Text>
              <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.label, lineHeight: 21, ...rtlText }}>اختار 5 أو 10 أو 20 أو كل الكلمات الجاهزة، وبعدها سوايب.</Text>
            </View>
            <Text aria-hidden style={{ color: colors.surface, fontSize: 26 }}>←</Text>
          </View>
        </Surface>
      </Pressable>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>زوّد حصيلتك</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {ACTIONS.slice(1, 4).map((action) => (
            <Pressable
              key={action.title}
              onPress={() => router.push(action.href)}
              style={({ pressed }) => ({ flexGrow: 1, flexBasis: 210, opacity: pressed ? 0.72 : 1 })}
            >
              <Surface style={{ minHeight: 142, padding: spacing.md, gap: spacing.sm, alignItems: 'flex-end' }}>
                <Text aria-hidden style={{ fontSize: 30 }}>{action.icon}</Text>
                <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: '900', ...rtlText }}>{action.title}</Text>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 20, ...rtlText }}>{action.body}</Text>
              </Surface>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>مساحتك</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {ACTIONS.slice(4).map((action) => (
            <Pressable key={action.title} onPress={() => router.push(action.href)} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.72 : 1 })}>
              <Surface style={{ padding: spacing.md, gap: spacing.xs, borderRadius: radius.lg, alignItems: 'flex-end' }}>
                <Text aria-hidden style={{ fontSize: 26 }}>{action.icon}</Text>
                <Text selectable style={{ color: colors.ink, fontSize: 17, fontWeight: '900', ...rtlText }}>{action.title}</Text>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 18, ...rtlText }}>{action.body}</Text>
              </Surface>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
