import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, ProgressBar, Surface } from '@/components/primitives';
import { SwipeGradeCard } from '@/components/swipe-grade-card';
import { MAHAND_UNITS } from '@/curriculum/mahand/data';
import type { MahandItem } from '@/curriculum/mahand/types';
import type { ReviewGrade } from '@/domain/types';
import { addHardWord, listHardWordIds } from './hard-words-store';
import { SpeechButton } from './speech-button';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

function flattenUnit(unitId: string): MahandItem[] {
  const unit = MAHAND_UNITS.find((candidate) => candidate.id === unitId);
  if (!unit) return [];
  return unit.groups.flatMap((group) => [...group.items]);
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

export function MahandStudyScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ unitId?: string | string[] }>();
  const unitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId ?? '';
  const unit = useMemo(() => MAHAND_UNITS.find((candidate) => candidate.id === unitId) ?? null, [unitId]);
  const items = useMemo(() => flattenUnit(unitId), [unitId]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [knew, setKnew] = useState(0);
  const [forgot, setForgot] = useState(0);
  const [hardWordIds, setHardWordIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    void listHardWordIds(db).then((ids) => {
      if (active) setHardWordIds(new Set(ids));
    });
    return () => { active = false; };
  }, [db]);

  const current = items[index] ?? null;
  const finished = items.length > 0 && index >= items.length;

  async function addCurrentToHardWords() {
    if (!current || hardWordIds.has(current.id)) return;
    await addHardWord(db, current.id);
    setHardWordIds((existing) => new Set(existing).add(current.id));
  }

  function grade(value: ReviewGrade) {
    if (!current || !revealed) return;
    if (value === 'KNEW') setKnew((count) => count + 1);
    else setForgot((count) => count + 1);
    setIndex((value) => value + 1);
    setRevealed(false);
  }

  function restart() {
    setIndex(0);
    setRevealed(false);
    setKnew(0);
    setForgot(0);
  }

  if (!unit || items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, padding: spacing.lg, justifyContent: 'center' }}>
        <Surface style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '900', ...rtlText }}>الوحدة مش موجودة</Text>
          <ActionButton label="ارجع للوحدات" onPress={() => router.replace('/')} />
        </Surface>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.md, gap: spacing.md, paddingBottom: 44 }}
      >
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '900', ...rtlText }}>وحدة {unit.number}</Text>
            <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: 26, lineHeight: 34, fontWeight: '900', ...rtlText }}>{unit.title}</Text>
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

        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '800', ...rtlText }}>
              {finished ? 'خلصت الوحدة' : `${index + 1} من ${items.length}`}
            </Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '800', ...rtlText }}>
              عارفها {knew} · نسيتها {forgot}
            </Text>
          </View>
          <ProgressBar value={finished ? 1 : index / items.length} />
        </View>

        {finished ? (
          <Surface style={{ padding: spacing.xl, gap: spacing.lg, alignItems: 'stretch' }}>
            <View style={{ gap: spacing.sm, alignItems: 'center' }}>
              <Text selectable style={{ fontSize: 46 }}>✅</Text>
              <Text selectable style={{ color: colors.ink, fontSize: 32, fontWeight: '900', ...rtlText }}>خلصت الوحدة كلها</Text>
              <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 26, ...rtlText }}>
                عارفها: {knew} · نسيتها: {forgot}. تقدر تعيد نفس الوحدة فورًا براحتك.
              </Text>
            </View>
            <ActionButton label="اختبر الوحدة تاني" onPress={restart} />
            <ActionButton label="ارجع للوحدات" onPress={() => router.replace('/')} />
          </Surface>
        ) : current ? (
          <>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={hardWordIds.has(current.id) ? 'الكلمة موجودة في الكلمات العنيدة' : 'ضيف الكلمة للكلمات العنيدة'}
                disabled={hardWordIds.has(current.id)}
                onPress={() => void addCurrentToHardWords()}
                style={({ pressed }) => ({
                  minHeight: 44,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.pill,
                  backgroundColor: hardWordIds.has(current.id) ? colors.successSurface : colors.ink,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <Text selectable style={{ color: hardWordIds.has(current.id) ? colors.success : colors.surface, fontWeight: '900' }}>
                  {hardWordIds.has(current.id) ? '✓ في الكلمات العنيدة' : '+ الكلمات العنيدة'}
                </Text>
              </Pressable>
              <SpeechButton text={current.term} label="نطق الكلمة" />
            </View>

            <SwipeGradeCard key={current.id} disabled={!revealed} onGrade={grade}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={revealed ? `${current.term}. ${current.translation}` : `${current.term}. دوس عشان تشوف المعنى.`}
                onPress={() => setRevealed(true)}
              >
                <Surface style={{ minHeight: 400, padding: spacing.xl, justifyContent: 'center' }}>
                  {!revealed ? (
                    <View style={{ gap: spacing.lg, alignItems: 'center' }}>
                      <Text selectable adjustsFontSizeToFit minimumFontScale={0.55} numberOfLines={3} style={{ color: colors.ink, fontSize: 44, lineHeight: 56, fontWeight: '900', textAlign: 'center' }}>
                        {current.term}
                      </Text>
                      <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, ...rtlText }}>
                        دوس على الكارت عشان تشوف المعنى
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: spacing.lg, alignItems: 'stretch' }}>
                      <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontWeight: '900', textAlign: 'center' }}>{current.term}</Text>
                      <Text selectable style={{ color: colors.ink, fontSize: 34, lineHeight: 46, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' }}>
                        {current.translation}
                      </Text>
                      {current.example.trim() ? (
                        <View style={{ gap: spacing.sm, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing.md }}>
                          <Text selectable style={{ color: colors.ink, fontSize: typography.body, lineHeight: 27, textAlign: 'center' }}>“{current.example}”</Text>
                          {current.exampleTranslation.trim() ? (
                            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 22, ...rtlText }}>{current.exampleTranslation}</Text>
                          ) : null}
                          <View style={{ alignItems: 'center' }}>
                            <SpeechButton text={current.example} label="نطق الجملة" />
                          </View>
                        </View>
                      ) : null}
                    </View>
                  )}
                </Surface>
              </Pressable>
            </SwipeGradeCard>

            {revealed ? (
              <>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <GradeButton label="نسيتها ↻" tone="danger" onPress={() => grade('FORGOT')} />
                  <GradeButton label="عارفها ✓" tone="success" onPress={() => grade('KNEW')} />
                </View>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, textAlign: 'center', ...rtlText }}>
                  أو اسحب شمال لو نسيتها، ويمين لو عارفها.
                </Text>
              </>
            ) : (
              <ActionButton label="اظهر المعنى" onPress={() => setRevealed(true)} />
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
