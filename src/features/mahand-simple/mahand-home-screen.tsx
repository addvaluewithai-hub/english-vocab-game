import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Surface } from '@/components/primitives';
import { MAHAND_STATS, MAHAND_UNITS } from '@/curriculum/mahand/data';
import type { MahandUnit } from '@/curriculum/mahand/types';
import { listHardWordIds } from './hard-words-store';
import { listForgottenCountsByUnit } from './unit-progress-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

function countUnit(unit: MahandUnit): number {
  return unit.groups.reduce((total, group) => total + group.items.length, 0);
}

export function MahandHomeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [hardWordCount, setHardWordCount] = useState(0);
  const [forgottenCounts, setForgottenCounts] = useState<Record<string, number>>({});

  const reloadStats = useCallback(async () => {
    const [hardIds, counts] = await Promise.all([
      listHardWordIds(db),
      listForgottenCountsByUnit(db),
    ]);
    setHardWordCount(hardIds.length);
    setForgottenCounts(counts);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void reloadStats();
    }, [reloadStats]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.md, gap: spacing.md, paddingBottom: 44 }}
      >
        <Surface style={{ padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.ink }}>
          <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.small, fontWeight: '900', ...rtlText }}>
            كورس مهند · {MAHAND_STATS.unitCount} وحدة
          </Text>
          <Text accessibilityRole="header" selectable style={{ color: colors.surface, fontSize: 38, lineHeight: 48, fontWeight: '900', ...rtlText }}>
            اختار الوحدة وابدأ الاختبار
          </Text>
          <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.body, lineHeight: 27, ...rtlText }}>
            نتيجتك على كل كلمة بتتسجل. تقدر تختبر الوحدة كلها، أو ترجع فقط للكلمات اللي آخر مرة قلت عليها نسيتها.
          </Text>
        </Surface>

        <Surface style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '900', ...rtlText }}>
                🔥 الكلمات العنيدة
              </Text>
              <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 22, ...rtlText }}>
                {hardWordCount === 0
                  ? 'لسه فاضية. ضيف أي كلمة من زر + أثناء الاختبار.'
                  : `${hardWordCount} كلمة مستنياك. راجعهم كلهم بالسوايب زي الوحدات.`}
              </Text>
            </View>
            <View style={{ minWidth: 50, height: 50, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
              <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>{hardWordCount}</Text>
            </View>
          </View>
          <ActionButton label={hardWordCount === 0 ? 'افتح الكلمات العنيدة' : 'العب الكلمات العنيدة'} onPress={() => router.push('/hard-words')} />
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 20, ...rtlText }}>
            السوايب هنا للمراجعة بس. أي كلمة هتفضل محفوظة لحد ما تضغط زر الحذف بنفسك.
          </Text>
        </Surface>

        <View style={{ gap: spacing.sm }}>
          <Text selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '900', ...rtlText }}>
            الوحدات
          </Text>
          {MAHAND_UNITS.map((unit) => {
            const forgottenCount = forgottenCounts[unit.id] ?? 0;
            return (
              <Surface key={unit.id} style={{ padding: spacing.md, gap: spacing.md }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '900', ...rtlText }}>
                      وحدة {unit.number} · {countUnit(unit)} كلمة · نسيت {forgottenCount}
                    </Text>
                    <Text selectable style={{ color: colors.ink, fontSize: 22, lineHeight: 30, fontWeight: '900', ...rtlText }}>
                      {unit.title}
                    </Text>
                  </View>
                  <View style={{ minWidth: 42, height: 42, paddingHorizontal: spacing.xs, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: forgottenCount > 0 ? colors.dangerSurface : colors.surfaceMuted }}>
                    <Text selectable style={{ color: forgottenCount > 0 ? colors.danger : colors.inkMuted, fontSize: 16, fontWeight: '900' }}>{forgottenCount}</Text>
                  </View>
                </View>

                <View style={{ gap: spacing.sm }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`اختبر وحدة ${unit.number} كلها`}
                    onPress={() => router.push({ pathname: '/study', params: { unitId: unit.id, mode: 'all' } })}
                    style={({ pressed }) => ({
                      minHeight: 50,
                      borderRadius: radius.pill,
                      backgroundColor: colors.ink,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.72 : 1,
                    })}
                  >
                    <Text selectable style={{ color: colors.surface, fontSize: typography.label, fontWeight: '900' }}>اختبر الوحدة كلها</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={forgottenCount > 0 ? `اختبر ${forgottenCount} كلمة نسيتها في وحدة ${unit.number}` : `مفيش كلمات منسية في وحدة ${unit.number}`}
                    disabled={forgottenCount === 0}
                    onPress={() => router.push({ pathname: '/study', params: { unitId: unit.id, mode: 'forgotten' } })}
                    style={({ pressed }) => ({
                      minHeight: 50,
                      borderRadius: radius.pill,
                      backgroundColor: forgottenCount > 0 ? colors.dangerSurface : colors.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: forgottenCount === 0 ? 0.55 : pressed ? 0.72 : 1,
                    })}
                  >
                    <Text selectable style={{ color: forgottenCount > 0 ? colors.danger : colors.inkMuted, fontSize: typography.label, fontWeight: '900' }}>
                      {forgottenCount > 0 ? `اختبر اللي نسيته بس · ${forgottenCount}` : 'مفيش كلمات منسية'}
                    </Text>
                  </Pressable>
                </View>
              </Surface>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
