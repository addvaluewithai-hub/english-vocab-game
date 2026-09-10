import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Surface } from '@/components/primitives';
import { MAHAND_STATS, MAHAND_UNITS } from '@/curriculum/mahand/data';
import type { MahandItem, MahandUnit } from '@/curriculum/mahand/types';
import { listHardWordIds, removeHardWord } from './hard-words-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

type LocatedItem = { item: MahandItem; unit: MahandUnit };

const ITEMS_BY_ID = new Map<string, LocatedItem>();
for (const unit of MAHAND_UNITS) {
  for (const group of unit.groups) {
    for (const item of group.items) ITEMS_BY_ID.set(item.id, { item, unit });
  }
}

function countUnit(unit: MahandUnit): number {
  return unit.groups.reduce((total, group) => total + group.items.length, 0);
}

export function MahandHomeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [hardWordIds, setHardWordIds] = useState<string[]>([]);

  const reloadHardWords = useCallback(async () => {
    setHardWordIds(await listHardWordIds(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void reloadHardWords();
    }, [reloadHardWords]),
  );

  const hardWords = useMemo(
    () => hardWordIds.map((id) => ITEMS_BY_ID.get(id)).filter((entry): entry is LocatedItem => Boolean(entry)),
    [hardWordIds],
  );

  async function remove(itemId: string) {
    await removeHardWord(db, itemId);
    setHardWordIds((current) => current.filter((id) => id !== itemId));
  }

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

        <Surface style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ gap: 4 }}>
            <Text selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '900', ...rtlText }}>
              الكلمات العنيدة
            </Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 22, ...rtlText }}>
              أي كلمة تضيفها من زر + في الاختبار هتفضل هنا لحد ما تمسحها بنفسك من زر الحذف.
            </Text>
          </View>

          {hardWords.length === 0 ? (
            <View style={{ paddingVertical: spacing.lg, gap: spacing.xs, alignItems: 'center' }}>
              <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>لسه فاضية 🎉</Text>
              <Text selectable style={{ color: colors.inkMuted, ...rtlText }}>لما تقابلك كلمة رخمة، دوس + فوق الكارت.</Text>
            </View>
          ) : (
            hardWords.map(({ item, unit }) => (
              <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm }}>
                <View style={{ gap: 3 }}>
                  <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: '900' }}>{item.term}</Text>
                  <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, ...rtlText }}>{item.translation}</Text>
                  <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, ...rtlText }}>وحدة {unit.number} · {unit.title}</Text>
                </View>
                <ActionButton label="احذف من الكلمات العنيدة" tone="danger" onPress={() => void remove(item.id)} />
              </View>
            ))
          )}
        </Surface>
      </ScrollView>
    </View>
  );
}
