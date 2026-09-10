import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Surface } from '@/components/primitives';
import { MAHAND_STATS, MAHAND_UNITS } from '@/curriculum/mahand/data';
import type { MahandUnit } from '@/curriculum/mahand/types';
import { listHardWordIds } from './hard-words-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

function countUnit(unit: MahandUnit): number {
  return unit.groups.reduce((total, group) => total + group.items.length, 0);
}

export function MahandHomeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [hardWordCount, setHardWordCount] = useState(0);

  const reloadHardWords = useCallback(async () => {
    const ids = await listHardWordIds(db);
    setHardWordCount(ids.length);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void reloadHardWords();
    }, [reloadHardWords]),
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
            كل ضغطة على وحدة بتبدأ اختبار جديد على كلمات الوحدة كلها. مفيش اختيار درس، ومفيش عدد كلمات، ومفيش انتظار لسيشن بكرة.
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
          {MAHAND_UNITS.map((unit) => (
            <Pressable
              key={unit.id}
              accessibilityRole="button"
              accessibilityLabel={`ابدأ اختبار وحدة ${unit.number}: ${unit.title}`}
              onPress={() => router.push({ pathname: '/study', params: { unitId: unit.id } })}
              style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
            >
              <Surface style={{ padding: spacing.md, gap: spacing.xs }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '900', ...rtlText }}>
                      وحدة {unit.number} · {countUnit(unit)} كلمة
                    </Text>
                    <Text selectable style={{ color: colors.ink, fontSize: 22, lineHeight: 30, fontWeight: '900', ...rtlText }}>
                      {unit.title}
                    </Text>
                  </View>
                  <View style={{ width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }}>
                    <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900' }}>←</Text>
                  </View>
                </View>
              </Surface>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
