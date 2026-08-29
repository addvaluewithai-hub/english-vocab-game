import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { CurriculumBankService, type CurriculumImportResult, type CurriculumSelection } from '@/curriculum/bank-service';
import {
  CURRICULUM_PACKAGES,
  CURRICULUM_UNITS,
  curriculumSelectionKey,
  filterCurriculumPackages,
  type CurriculumKindFilter,
} from '@/curriculum/catalog';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { CoursePackageCard } from './course-package-card';

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 13,
        paddingVertical: 9,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.accent : colors.surfaceMuted,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Text selectable style={{ color: selected ? colors.surface : colors.inkMuted, fontSize: typography.label, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

function buildSelections(selectedKeys: ReadonlySet<string>): CurriculumSelection[] {
  return CURRICULUM_PACKAGES.flatMap((pkg) => {
    const itemIds = pkg.items
      .filter((item) => selectedKeys.has(curriculumSelectionKey(pkg.id, item.id)))
      .map((item) => item.id);
    return itemIds.length ? [{ packageId: pkg.id, itemIds }] : [];
  });
}

export function CourseLibraryScreen() {
  const router = useRouter();
  const sqlite = useSQLiteContext();
  const { loading: pairLoading, pair } = useActiveLanguagePair();
  const [unitId, setUnitId] = useState<'ALL' | string>('ALL');
  const [kind, setKind] = useState<CurriculumKindFilter>('ALL');
  const [query, setQuery] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CurriculumImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const packages = useMemo(
    () => filterCurriculumPackages({ level: 'A1', unitId, kind, query }),
    [kind, query, unitId],
  );
  const selectedCount = selectedKeys.size;

  function toggleItem(packageId: string, itemId: string) {
    const key = curriculumSelectionKey(packageId, itemId);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setResult(null);
  }

  function toggleVisible(pkg: (typeof packages)[number], select: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      for (const item of pkg.items) {
        const key = curriculumSelectionKey(pkg.id, item.id);
        if (select) next.add(key);
        else next.delete(key);
      }
      return next;
    });
    setResult(null);
  }

  async function addSelected() {
    if (!pair || saving || selectedCount === 0) return;
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const imported = await new CurriculumBankService(sqlite).addSelections(pair.id, buildSelections(selectedKeys));
      setResult(imported);
      if (!imported.failedItems.length) setSelectedKeys(new Set());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the selected course content.');
    } finally {
      setSaving(false);
    }
  }

  if (pairLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><Text selectable style={{ color: colors.inkMuted }}>Loading course library…</Text></View>;
  if (!pair) return <EmptyState title="Choose your languages" body="Set a language pair before adding course content to your bank." action={<ActionButton label="Open settings" onPress={() => router.push('/settings')} />} />;
  if (pair.targetLanguageCode !== 'en' || pair.referenceLanguageCode !== 'ar') {
    return <EmptyState title="English → Arabic for now" body="The curated A1 course export currently includes reviewed Arabic meanings. Change the active pair to English → Arabic, or keep using manual add for other language pairs." action={<ActionButton label="Open language settings" onPress={() => router.push('/settings')} />} />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
      style={{ flex: 1, backgroundColor: colors.canvas }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>Course library</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25 }}>Browse the scientific A1 curriculum as conversation packs. Pick a whole visible pack or individual words and phrases, then add them to the same Bank and Swipe flow as manual vocabulary.</Text>
      </View>

      <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Chip>A1 ready</Chip>
          <Text selectable style={{ flex: 1, color: colors.inkMuted, fontSize: typography.label }}>6 units · conversation-based packages · English → Arabic</Text>
        </View>
        <Text selectable style={{ color: colors.ink, fontWeight: '800' }}>Level</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <FilterChip label="A1" selected onPress={() => undefined} />
        </View>
      </Surface>

      <TextInput
        accessibilityLabel="Search course library"
        value={query}
        onChangeText={setQuery}
        placeholder="Search a topic, word, phrase, or Arabic meaning"
        placeholderTextColor={colors.inkMuted}
        style={{ minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.ink, fontSize: typography.body }}
      />

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontWeight: '800' }}>Topic / unit</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <FilterChip label="All topics" selected={unitId === 'ALL'} onPress={() => setUnitId('ALL')} />
          {CURRICULUM_UNITS.map((unit) => <FilterChip key={unit.id} label={unit.title} selected={unitId === unit.id} onPress={() => setUnitId(unit.id)} />)}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontWeight: '800' }}>Content type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {(['ALL', 'WORD', 'PHRASE'] as const).map((value) => <FilterChip key={value} label={value === 'ALL' ? 'Words + phrases' : value === 'WORD' ? 'Words' : 'Phrases'} selected={kind === value} onPress={() => setKind(value)} />)}
        </View>
      </View>

      {error ? <Surface style={{ padding: spacing.md, backgroundColor: colors.dangerSurface }}><Text accessibilityLiveRegion="polite" selectable style={{ color: colors.danger }}>{error}</Text></Surface> : null}
      {result ? (
        <Surface style={{ padding: spacing.md, gap: spacing.sm, backgroundColor: colors.successSurface }}>
          <Text accessibilityLiveRegion="polite" selectable style={{ color: colors.success, fontSize: typography.body, fontWeight: '800' }}>{result.added} added · {result.reused} already in your bank and linked · {result.collectionsCreated} package collections created</Text>
          {result.failedItems.length ? <Text selectable style={{ color: colors.danger }}>Could not add: {result.failedItems.join(', ')}</Text> : null}
          <View style={{ gap: spacing.sm }}>
            <ActionButton label="Open vocabulary bank" onPress={() => router.push('/bank')} />
            <ActionButton label="Start swipe study" onPress={() => router.push('/')} />
          </View>
        </Surface>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text selectable style={{ flex: 1, color: colors.ink, fontSize: typography.body, fontWeight: '800' }}>{packages.length} packages</Text>
        <Chip>{selectedCount} selected</Chip>
      </View>

      {packages.length ? packages.map((pkg) => (
        <CoursePackageCard key={pkg.id} pkg={pkg} selectedKeys={selectedKeys} onToggleItem={toggleItem} onToggleVisible={toggleVisible} />
      )) : <Surface style={{ padding: spacing.lg }}><Text selectable style={{ color: colors.inkMuted, textAlign: 'center' }}>No course items match these filters.</Text></Surface>}

      <ActionButton label={saving ? 'Adding to bank…' : `Add ${selectedCount} to bank`} disabled={saving || selectedCount === 0} onPress={() => void addSelected()} />
    </ScrollView>
  );
}
