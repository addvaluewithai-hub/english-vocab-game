import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, ProgressBar, Surface } from '@/components/primitives';
import { SwipeGradeCard } from '@/components/swipe-grade-card';
import { MAHAND_UNITS } from '@/curriculum/mahand/data';
import type { MahandItem, MahandUnit } from '@/curriculum/mahand/types';
import type { ReviewGrade } from '@/domain/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { listHardWordIds, removeHardWord } from './hard-words-store';
import { SpeechButton } from './speech-button';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

type LocatedItem = { item: MahandItem; unit: MahandUnit };

const ITEMS_BY_ID = new Map<string, LocatedItem>();
for (const unit of MAHAND_UNITS) {
  for (const group of unit.groups) {
    for (const item of group.items) ITEMS_BY_ID.set(item.id, { item, unit });
  }
}

function GradeButton({ label, tone, onPress }: { label: string; tone: 'success' | 'danger'; onPress: () => void }) {
  const palette = tone === 'success'
    ? { backgroundColor: colors.successSurface, color: colors.success }
    : { backgroundColor: colors.dangerSurface, color: colors.danger };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 54,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.backgroundColor,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Text selectable style={{ color: palette.color, fontSize: typography.body, fontWeight: '900' }}>{label}</Text>
    </Pressable>
  );
}

export function HardWordsStudyScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [items, setItems] = useState<LocatedItem[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [knew, setKnew] = useState(0);
  const [forgot, setForgot] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const ids = await listHardWordIds(db);
    const located = ids.map((id) => ITEMS_BY_ID.get(id)).filter((entry): entry is LocatedItem => Boolean(entry));
    setItems(located);
    setIndex(0);
    setRevealed(false);
    setKnew(0);
    setForgot(0);
    setLoaded(true);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const current = items[index] ?? null;
  const finished = items.length > 0 && index >= items.length;
  const progress = useMemo(() => {
    if (items.length === 0) return 0;
    return finished ? 1 : index / items.length;
  }, [finished, index, items.length]);

  function grade(value: ReviewGrade) {
    if (!current) return;
    if (value === 'KNEW') setKnew((count) => count + 1);
    else setForgot((count) => count + 1);
    setIndex((value) => value + 1);
    setRevealed(false);
  }

  async function removeCurrent() {
    if (!current) return;
    await removeHardWord(db, current.item.id);
    setItems((existing) => existing.filter(({ item }) => item.id !== current.item.id));
    setRevealed(false);
  }

  function restart() {
    setIndex(0);
    setRevealed(false);
    setKnew(0);
    setForgot(0);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.md, gap: spacing.md, paddingBottom: 44 }}
      >
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '900', ...rtlText }}>مراجعة خاصة</Text>
            <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: 28, lineHeight: 36, fontWeight: '900', ...rtlText }}>الكلمات العنيدة</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ارجع للوحدات"
            onPress={() => router.replace('/')}
            style={({ pressed }) => ({
              minHeight: 44,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Text selectable style={{ color: colors.ink, fontWeight: '900' }}>الوحدات</Text>
          </Pressable>
        </View>

        {!loaded ? (
          <Surface style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text selectable style={{ color: colors.inkMuted, ...rtlText }}>بجهز الكلمات…</Text>
          </Surface>
        ) : items.length === 0 ? (
          <Surface style={{ padding: spacing.xl, gap: spacing.md, alignItems: 'stretch' }}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Text selectable style={{ fontSize: 46 }}>🎉</Text>
              <Text selectable style={{ color: colors.ink, fontSize: 28, fontWeight: '900', ...rtlText }}>مفيش كلمات عنيدة دلوقتي</Text>
              <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 26, ...rtlText }}>
                ضيف أي كلمة من زر + أثناء مذاكرة الوحدات، وهتظهر هنا تلقائيًا.
              </Text>
            </View>
            <ActionButton label="ارجع للوحدات" onPress={() => router.replace('/')} />
          </Surface>
        ) : (
          <>
            <View style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '800', ...rtlText }}>
                  {finished ? 'خلصت الجولة' : `${index + 1} من ${items.length}`}
                </Text>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '800', ...rtlText }}>
                  عارفها {knew} · نسيتها {forgot}
                </Text>
              </View>
              <ProgressBar value={progress} />
            </View>

            {finished ? (
              <Surface style={{ padding: spacing.xl, gap: spacing.lg, alignItems: 'stretch' }}>
                <View style={{ gap: spacing.sm, alignItems: 'center' }}>
                  <Text selectable style={{ fontSize: 46 }}>🔥</Text>
                  <Text selectable style={{ color: colors.ink, fontSize: 30, fontWeight: '900', ...rtlText }}>خلصت الكلمات العنيدة</Text>
                  <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 26, ...rtlText }}>
                    عارفها: {knew} · نسيتها: {forgot}. السوايب ما مسحتش أي كلمة من القائمة.
                  </Text>
                </View>
                <ActionButton label="العب الجولة تاني" onPress={restart} />
                <ActionButton label="ارجع للوحدات" onPress={() => router.replace('/')} />
              </Surface>
            ) : current ? (
              <>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                  <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '800', ...rtlText }}>
                    وحدة {current.unit.number} · {current.unit.title}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="احذف من الكلمات العنيدة"
                    onPress={() => void removeCurrent()}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.pill,
                      backgroundColor: colors.dangerSurface,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.72 : 1,
                    })}
                  >
                    <Text selectable style={{ color: colors.danger, fontWeight: '900' }}>احذف</Text>
                  </Pressable>
                </View>

                <SwipeGradeCard key={current.item.id} disabled={false} onGrade={grade}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={revealed ? `${current.item.term}. ${current.item.translation}` : `${current.item.term}. دوس عشان تشوف المعنى، أو اسحب مباشرة.`}
                    onPress={() => setRevealed(true)}
                  >
                    <Surface style={{ minHeight: 400, padding: spacing.xl, justifyContent: 'center' }}>
                      {!revealed ? (
                        <View style={{ gap: spacing.lg, alignItems: 'center' }}>
                          <Text selectable adjustsFontSizeToFit minimumFontScale={0.55} numberOfLines={3} style={{ color: colors.ink, fontSize: 44, lineHeight: 56, fontWeight: '900', textAlign: 'center' }}>
                            {current.item.term}
                          </Text>
                          <SpeechButton text={current.item.term} label="نطق الكلمة" />
                          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, ...rtlText }}>
                            دوس للمعنى، أو اسحب مباشرة: يمين عارفها · شمال نسيتها
                          </Text>
                        </View>
                      ) : (
                        <View style={{ gap: spacing.lg, alignItems: 'stretch' }}>
                          <View style={{ gap: spacing.sm, alignItems: 'center' }}>
                            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontWeight: '900', textAlign: 'center' }}>{current.item.term}</Text>
                            <SpeechButton text={current.item.term} label="نطق الكلمة" />
                          </View>
                          <Text selectable style={{ color: colors.ink, fontSize: 34, lineHeight: 46, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' }}>
                            {current.item.translation}
                          </Text>
                          {current.item.example.trim() ? (
                            <View style={{ gap: spacing.sm, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing.md }}>
                              <Text selectable style={{ color: colors.ink, fontSize: typography.body, lineHeight: 27, textAlign: 'center' }}>“{current.item.example}”</Text>
                              {current.item.exampleTranslation.trim() ? (
                                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 22, ...rtlText }}>{current.item.exampleTranslation}</Text>
                              ) : null}
                              <View style={{ alignItems: 'center' }}>
                                <SpeechButton text={current.item.example} label="نطق الجملة" />
                              </View>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </Surface>
                  </Pressable>
                </SwipeGradeCard>

                {revealed ? (
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <GradeButton label="نسيتها ↻" tone="danger" onPress={() => grade('FORGOT')} />
                    <GradeButton label="عارفها ✓" tone="success" onPress={() => grade('KNEW')} />
                  </View>
                ) : (
                  <ActionButton label="اظهر المعنى" onPress={() => setRevealed(true)} />
                )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
