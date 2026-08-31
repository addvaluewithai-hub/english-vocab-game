import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { MAHAND_COURSE_DESCRIPTION, MAHAND_STATS, MAHAND_UNITS } from '@/curriculum/mahand/data';
import { MahandCourseImportService, type MahandImportResult } from '@/curriculum/mahand/import-service';
import type { MahandGroup, MahandUnit } from '@/curriculum/mahand/types';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

type BusyTarget = 'course' | `unit:${string}` | `group:${string}` | null;

function countUnit(unit: MahandUnit): number {
  return unit.groups.reduce((total, group) => total + group.items.length, 0);
}

function ResultBox({ result }: { result: MahandImportResult | null }) {
  if (!result) return null;
  return (
    <Surface style={{ padding: spacing.md, gap: spacing.xs, backgroundColor: colors.successSurface }}>
      <Text selectable style={{ color: colors.success, fontSize: typography.body, fontWeight: '900', ...rtlText }}>
        اتضافوا لبنك الكلمات ✅
      </Text>
      <Text selectable style={{ color: colors.success, lineHeight: 22, ...rtlText }}>
        جديد: {result.added} · موجود واتربط: {result.reused} · إجمالي: {result.requested}
      </Text>
    </Surface>
  );
}

function UnitTab({ unit, selected, onPress }: { unit: MahandUnit; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 142,
        minHeight: 96,
        padding: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.ink : colors.surface,
        opacity: pressed ? 0.72 : 1,
        justifyContent: 'space-between',
      })}
    >
      <Text selectable style={{ color: selected ? colors.surfaceMuted : colors.inkMuted, fontSize: 11, fontWeight: '900', ...rtlText }}>
        وحدة {unit.number} · {unit.groups.length} جروبات
      </Text>
      <Text selectable numberOfLines={2} style={{ color: selected ? colors.surface : colors.ink, fontSize: typography.label, fontWeight: '900', ...rtlText }}>
        {unit.title}
      </Text>
      <Text selectable style={{ color: selected ? colors.surfaceMuted : colors.inkMuted, fontSize: 11, fontWeight: '800', ...rtlText }}>
        {countUnit(unit)} كلمة
      </Text>
    </Pressable>
  );
}

function GroupCard({ unit, group, busy, onImport }: { unit: MahandUnit; group: MahandGroup; busy: boolean; onImport: () => void }) {
  const preview = group.items.slice(0, 8).map((item) => item.term).join(' · ');
  return (
    <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row-reverse', gap: spacing.sm, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '900', ...rtlText }}>
            جروب {group.number} · صفحة {group.page}
          </Text>
          <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>
            {group.title}
          </Text>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 22, ...rtlText }}>
            {group.items.length} كلمة · {preview}
          </Text>
        </View>
        <Chip>{unit.title}</Chip>
      </View>
      <ActionButton label={busy ? 'بنضيف الجروب…' : 'ضيف الجروب'} disabled={busy} onPress={onImport} />
    </Surface>
  );
}

export function MahandCourseScreen() {
  const router = useRouter();
  const sqlite = useSQLiteContext();
  const { loading, pair } = useActiveLanguagePair();
  const [selectedUnitId, setSelectedUnitId] = useState(MAHAND_UNITS[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<BusyTarget>(null);
  const [result, setResult] = useState<MahandImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedUnit = useMemo(
    () => MAHAND_UNITS.find((unit) => unit.id === selectedUnitId) ?? MAHAND_UNITS[0] ?? null,
    [selectedUnitId],
  );

  const visibleGroups = useMemo(() => {
    if (!selectedUnit) return [];
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return selectedUnit.groups;
    return selectedUnit.groups.filter((group) => {
      const haystack = [group.title, ...group.items.flatMap((item) => [item.term, item.translation, item.example])]
        .join(' ')
        .toLocaleLowerCase();
      return haystack.includes(needle);
    });
  }, [query, selectedUnit]);

  async function run(target: BusyTarget, action: (service: MahandCourseImportService, languagePairId: string) => Promise<MahandImportResult>) {
    if (!pair || busy) return;
    setBusy(target);
    setError(null);
    setResult(null);
    try {
      const imported = await action(new MahandCourseImportService(sqlite), pair.id);
      setResult(imported);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'مقدرناش نضيف كلمات مهند دلوقتي.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <EmptyState title="بنجهز مهند" body="ثواني ونفتح مرجع المذاكرة." />;
  }
  if (!pair) {
    return <EmptyState title="بنجهز الإنجليزي" body="English → Arabic بيتعمل تلقائي أول ما تفتح التطبيق." />;
  }
  if (!selectedUnit) {
    return <EmptyState title="مهند مش جاهز" body="بيانات الكورس لسه ما اتحملتش." />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.md, gap: spacing.md, paddingBottom: 42 }}
      >
        <Surface style={{ padding: spacing.lg, gap: spacing.md, backgroundColor: colors.ink }}>
          <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.small, fontWeight: '900', ...rtlText }}>كورس مهند</Text>
          <Text accessibilityRole="header" selectable style={{ color: colors.surface, fontSize: 36, fontWeight: '900', ...rtlText }}>
            مرجع المذاكرة الأساسي
          </Text>
          <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.label, lineHeight: 23, ...rtlText }}>
            {MAHAND_COURSE_DESCRIPTION} اختار جروب، وحدة، أو ضيف الكورس كله للبنك.
          </Text>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm }}>
            <Chip>{MAHAND_STATS.unitCount} وحدة</Chip>
            <Chip>{MAHAND_STATS.groupCount} جروب</Chip>
            <Chip>{MAHAND_STATS.itemCount} كلمة</Chip>
          </View>
          <ActionButton
            label={busy === 'course' ? 'بنضيف كورس مهند…' : 'ضيف كورس مهند كله'}
            disabled={Boolean(busy)}
            onPress={() => run('course', (service, languagePairId) => service.importCourse(languagePairId, MAHAND_UNITS))}
          />
        </Surface>

        <ResultBox result={result} />
        {error ? <Text selectable style={{ color: colors.danger, fontWeight: '800', ...rtlText }}>{error}</Text> : null}

        <View style={{ flexDirection: 'row-reverse', gap: spacing.sm, alignItems: 'center' }}>
          <Text selectable style={{ flex: 1, color: colors.ink, fontSize: typography.title, fontWeight: '900', ...rtlText }}>اختار وحدة</Text>
          <ActionButton label="ذاكر" onPress={() => router.push('/study')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.md }}>
          {MAHAND_UNITS.map((unit) => (
            <UnitTab key={unit.id} unit={unit} selected={unit.id === selectedUnit.id} onPress={() => setSelectedUnitId(unit.id)} />
          ))}
        </ScrollView>

        <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
          <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: '900', ...rtlText }}>
            {selectedUnit.title}
          </Text>
          <Text selectable style={{ color: colors.inkMuted, ...rtlText }}>
            {selectedUnit.groups.length} جروبات · {countUnit(selectedUnit)} كلمة
          </Text>
          <ActionButton
            label={busy === `unit:${selectedUnit.id}` ? 'بنضيف الوحدة…' : 'ضيف الوحدة كلها'}
            disabled={Boolean(busy)}
            onPress={() => run(`unit:${selectedUnit.id}`, (service, languagePairId) => service.importUnit(languagePairId, selectedUnit))}
          />
        </Surface>

        <TextInput
          accessibilityLabel="دور في مهند"
          value={query}
          onChangeText={setQuery}
          placeholder="دور على كلمة، ترجمة، أو جملة…"
          placeholderTextColor={colors.inkMuted}
          style={{ minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.ink, fontSize: typography.label, ...rtlText }}
        />

        {visibleGroups.map((group) => (
          <GroupCard
            key={group.id}
            unit={selectedUnit}
            group={group}
            busy={busy === `group:${group.id}`}
            onImport={() => run(`group:${group.id}`, (service, languagePairId) => service.importGroup(languagePairId, selectedUnit, group))}
          />
        ))}
      </ScrollView>
    </View>
  );
}
