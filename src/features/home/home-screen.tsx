import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { Surface } from '@/components/primitives';

type HomeAction = {
  title: string;
  body: string;
  icon: string;
  href: '/' | '/study' | '/course-library' | '/smart-import' | '/add' | '/bank' | '/stats';
  prominent?: boolean;
};

const ACTIONS: HomeAction[] = [
  { title: 'Study now', body: 'Start a quick swipe round.', icon: '⚡', href: '/study', prominent: true },
  { title: 'A1 Adventure', body: 'Explore worlds and collect useful words.', icon: '🗺️', href: '/course-library' },
  { title: 'Smart Import', body: 'Text, images, PDF, YouTube or a web page.', icon: '✨', href: '/smart-import' },
  { title: 'Quick Add', body: 'Add one word and let Gemini help.', icon: '+', href: '/add' },
  { title: 'Vocabulary Bank', body: 'Search, edit and organize your words.', icon: '▤', href: '/bank' },
  { title: 'Progress', body: 'See your learning stats.', icon: '🏆', href: '/stats' },
];

export function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl }}
      style={{ flex: 1, backgroundColor: colors.canvas }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontWeight: '800' }}>VOCAB FLOW</Text>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: 34, lineHeight: 40, fontWeight: '900' }}>What do you want to do?</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 24 }}>Study, collect course vocabulary, or bring your own words in. Everything ends up in the same Bank.</Text>
      </View>

      <Pressable onPress={() => router.push('/study')} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
        <Surface style={{ padding: spacing.lg, gap: spacing.md, backgroundColor: colors.ink }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
              <Text aria-hidden style={{ fontSize: 30 }}>⚡</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text selectable style={{ color: colors.surface, fontSize: 24, fontWeight: '900' }}>Start a study round</Text>
              <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.label, lineHeight: 20 }}>Choose 5, 10, 20 or all due cards, then swipe.</Text>
            </View>
            <Text aria-hidden style={{ color: colors.surface, fontSize: 26 }}>→</Text>
          </View>
        </Surface>
      </Pressable>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900' }}>Build your vocabulary</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {ACTIONS.slice(1, 4).map((action) => (
            <Pressable
              key={action.title}
              onPress={() => router.push(action.href)}
              style={({ pressed }) => ({ flexGrow: 1, flexBasis: 210, opacity: pressed ? 0.72 : 1 })}
            >
              <Surface style={{ minHeight: 142, padding: spacing.md, gap: spacing.sm }}>
                <Text aria-hidden style={{ fontSize: 30 }}>{action.icon}</Text>
                <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: '900' }}>{action.title}</Text>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 20 }}>{action.body}</Text>
              </Surface>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900' }}>Your space</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {ACTIONS.slice(4).map((action) => (
            <Pressable key={action.title} onPress={() => router.push(action.href)} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.72 : 1 })}>
              <Surface style={{ padding: spacing.md, gap: spacing.xs, borderRadius: radius.lg }}>
                <Text aria-hidden style={{ fontSize: 26 }}>{action.icon}</Text>
                <Text selectable style={{ color: colors.ink, fontSize: 17, fontWeight: '900' }}>{action.title}</Text>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 18 }}>{action.body}</Text>
              </Surface>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
