import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip, Surface } from '@/components/primitives';
import { A1_CATALOG_STATS } from '@/curriculum/catalog';
import { MAHAND_COURSE_DESCRIPTION, MAHAND_STATS } from '@/curriculum/mahand/data';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

function CourseCard({
  title,
  subtitle,
  icon,
  meta,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}>
      <Surface style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row-reverse', gap: spacing.md, alignItems: 'flex-start' }}>
          <View style={{ width: 62, height: 62, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }}>
            <Text aria-hidden style={{ fontSize: 32 }}>{icon}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', gap: spacing.xs }}>
            <Text selectable style={{ color: colors.ink, fontSize: 26, fontWeight: '900', ...rtlText }}>{title}</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 22, ...rtlText }}>{subtitle}</Text>
            <Chip>{meta}</Chip>
          </View>
        </View>
      </Surface>
    </Pressable>
  );
}

export function CourseHubScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.md, gap: spacing.md, paddingBottom: 42 }}>
        <Surface style={{ padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.ink }}>
          <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.small, fontWeight: '900', ...rtlText }}>الكورسات</Text>
          <Text selectable accessibilityRole="header" style={{ color: colors.surface, fontSize: 36, fontWeight: '900', ...rtlText }}>
            اختار المرجع اللي هتذاكر منه
          </Text>
          <Text selectable style={{ color: colors.surfaceMuted, lineHeight: 23, ...rtlText }}>
            A1 Adventure للمغامرة المنظمة، ومهند كمرجع أساسي مقسم وحدات وجروبات.
          </Text>
        </Surface>
        <CourseCard
          title="A1 Adventure"
          subtitle="مغامرة A1 الجاهزة: عوالم، مهمات، وكلمات مختارة للتدريب."
          icon="🗺️"
          meta={`${A1_CATALOG_STATS.missionCount} مهمة`}
          onPress={() => router.push('/a1-course')}
        />
        <CourseCard
          title="مهند"
          subtitle={MAHAND_COURSE_DESCRIPTION}
          icon="📚"
          meta={`${MAHAND_STATS.unitCount} وحدة · ${MAHAND_STATS.groupCount} جروب · ${MAHAND_STATS.itemCount} كلمة`}
          onPress={() => router.push('/mahand-course')}
        />
      </ScrollView>
    </View>
  );
}
