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
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.accent : colors.surfaceMuted,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Text selectable numberOfLines={1} style={{ color: selected ? colors.surface : colors.inkMuted, fontSize: typography.small, fontWeight: '800' }}>
        {label}
      </Text>
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

const READY_ENTRY_COUNT = CURRICULUM_PACKAGES.reduce((total, pkg) => total + pkg.items.length, 0);

export function CourseLibraryScreen() {
  const router = useRouter();
  const sqlite = useSQLiteContext();
  const { loading: pairLoading, pair } = useActiveLanguagePair();
  const [unitId, setUnitId] = useState<'ALL' | string>('ALL');
  const [kind, setKind] = useState<CurriculumKindFilter>('ALL');
  const [query, setQuery] = useState('');
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CurriculumImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const packages = useMemo(
    () => filterCurriculumPackages({ level: 'A1', unitId, kind, query }),
    [kind, query, unitId],
  );
  const selectedCount = selectedKeys.size;
  const visibleEntryCount = packages.reduce((total, pkg) => total + pkg.items.length, 0);

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

  if (pairLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <Text selectable style={{ color: colors.inkMuted }}>Loading course library…</Text>
      </View>
    );
  }
  if (!pair) {
    return <EmptyState title="Choose your languages" body="Set a language pair before adding course content to your bank." action={<ActionButton label="Open settings" onPress={() => router.push('/settings')} />} />;
  }
  if (pair.targetLanguageCode !== 'en' || pair.referenceLanguageCode !== 'ar') {
    return <EmptyState title="English → Arabic for now" body="The curated A1 course export currently includes reviewed Arabic meanings. Change the active pair to English → Arabic, or keep using manual add for other language pairs." action={<ActionButton label="Open language settings" onPress={() => router.push('/settings')} />} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.md, gap: spacing.md, paddingBottom: selectedCount ? 116 : 32 }}
      >
        <View style={{ gap: 5, paddingTop: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text accessibilityRole="header" selectable style={{ flex: 1, color: colors.ink, fontSize: typography.title, fontWeight: '900' }}>
              A1 Course Library
            </Text>
            <Chip>English → Arabic</Chip>
          </View>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 20 }}>
            Pick a topic, choose only what you want, then send it straight to Bank and Swipe.
          </Text>
        </View>

        <Surface style={{ padding: spacing.md, gap: 7, backgroundColor: colors.surfaceMuted }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text selectable style={{ flex: 1, color: colors.ink, fontSize: typography.label, fontWeight: '850' }}>Reviewed app set</Text>
            <Text selectable style={{ color: colors.ink, fontSize: typography.label, fontWeight: '850' }}>{READY_ENTRY_COUNT} entries</Text>
          </View>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 18 }}>
            This preview is a curated A1 starter set, not the complete A1 lexical inventory. The full curriculum export is being prepared from the locked course source.
          </Text>
        </Surface>

        <TextInput
          accessibilityLabel="Search course library"
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            if (value.trim()) setExpandedPackageId(null);
          }}
          placeholder="Search English or Arabic…"
          placeholderTextColor={colors.inkMuted}
          style={{
            minHeight: 48,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            color: colors.ink,
            fontSize: typography.body,
          }}
        />

        <View style={{ gap: spacing.xs }}>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '800' }}>UNIT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.md }}>
            <FilterChip label="All" selected={unitId === 'ALL'} onPress={() => setUnitId('ALL')} />
            {CURRICULUM_UNITS.map((unit) => (
              <FilterChip
                key={unit.id}
                label={`U${unit.number} · ${unit.title}`}
                selected={unitId === unit.id}
                onPress={() => {
                  setUnitId(unit.id);
                  setExpandedPackageId(null);
                }}
              />
            ))}
          </ScrollView>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: spacing.sm }}>
            {(['ALL', 'WORD', 'PHRASE'] as const).map((value) => (
              <FilterChip
                key={value}
                label={value === 'ALL' ? 'All' : value === 'WORD' ? 'Words' : 'Phrases'}
                selected={kind === value}
                onPress={() => setKind(value)}
              />
            ))}
          </View>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>
            {visibleEntryCount} shown
          </Text>
        </View>

        {error ? (
          <Surface style={{ padding: spacing.md, backgroundColor: colors.dangerSurface }}>
            <Text accessibilityLiveRegion="polite" selectable style={{ color: colors.danger }}>{error}</Text>
          </Surface>
        ) : null}

        {result ? (
          <Surface style={{ padding: spacing.md, gap: spacing.sm, backgroundColor: colors.successSurface }}>
            <Text accessibilityLiveRegion="polite" selectable style={{ color: colors.success, fontSize: typography.label, fontWeight: '850' }}>
              {result.added} added · {result.reused} already linked · {result.collectionsCreated} topic collections created
            </Text>
            {result.failedItems.length ? <Text selectable style={{ color: colors.danger }}>Could not add: {result.failedItems.join(', ')}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <Pressable accessibilityRole="button" onPress={() => router.push('/bank')} style={({ pressed }) => ({ paddingVertical: 7, opacity: pressed ? 0.65 : 1 })}>
                <Text selectable style={{ color: colors.accent, fontSize: typography.label, fontWeight: '850' }}>Open Bank →</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push('/')} style={({ pressed }) => ({ paddingVertical: 7, opacity: pressed ? 0.65 : 1 })}>
                <Text selectable style={{ color: colors.accent, fontSize: typography.label, fontWeight: '850' }}>Start Swipe →</Text>
              </Pressable>
            </View>
          </Surface>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.ink, fontSize: typography.body, fontWeight: '900' }}>Topics</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>Open one topic at a time</Text>
          </View>
          <Chip>{packages.length} topics</Chip>
        </View>

        {packages.length ? packages.map((pkg) => (
          <CoursePackageCard
            key={pkg.id}
            pkg={pkg}
            expanded={expandedPackageId === pkg.id}
            selectedKeys={selectedKeys}
            onToggleExpanded={() => setExpandedPackageId((current) => current === pkg.id ? null : pkg.id)}
            onToggleItem={toggleItem}
            onToggleVisible={toggleVisible}
          />
        )) : (
          <Surface style={{ padding: spacing.lg }}>
            <Text selectable style={{ color: colors.inkMuted, textAlign: 'center' }}>No A1 entries match these filters.</Text>
          </Surface>
        )}
      </ScrollView>

      {selectedCount ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: spacing.md,
          }}
        >
          <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ minWidth: 92 }}>
              <Text selectable style={{ color: colors.ink, fontSize: typography.body, fontWeight: '900' }}>{selectedCount} selected</Text>
              <Pressable accessibilityRole="button" onPress={() => setSelectedKeys(new Set())}>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>Clear</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton label={saving ? 'Adding…' : 'Add to Bank'} disabled={saving} onPress={() => void addSelected()} />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
