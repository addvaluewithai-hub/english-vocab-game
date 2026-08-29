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

const WORLD_META: Record<number, { icon: string; shortTitle: string }> = {
  1: { icon: '👋', shortTitle: 'First connections' },
  2: { icon: '⏰', shortTitle: 'People & plans' },
  3: { icon: '🏠', shortTitle: 'Home & things' },
  4: { icon: '🧭', shortTitle: 'Places & travel' },
  5: { icon: '🛍️', shortTitle: 'Services & needs' },
  6: { icon: '💬', shortTitle: 'Messages & media' },
};

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 13,
        paddingVertical: 8,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.accent : colors.surface,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Text selectable numberOfLines={1} style={{ color: selected ? colors.surface : colors.inkMuted, fontSize: typography.small, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function WorldCard({
  number,
  title,
  selected,
  onPress,
}: {
  number: number | null;
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  const meta = number ? WORLD_META[number] : { icon: '🗺️', shortTitle: title };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 126,
        minHeight: 104,
        padding: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.ink : colors.surface,
        opacity: pressed ? 0.74 : 1,
        justifyContent: 'space-between',
      })}
    >
      <Text aria-hidden style={{ fontSize: 30 }}>{meta.icon}</Text>
      <View style={{ gap: 2 }}>
        <Text selectable style={{ color: selected ? colors.surfaceMuted : colors.inkMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }}>
          {number ? `WORLD ${number}` : 'A1 MAP'}
        </Text>
        <Text selectable numberOfLines={2} style={{ color: selected ? colors.surface : colors.ink, fontSize: typography.small, fontWeight: '900', lineHeight: 16 }}>
          {number ? meta.shortTitle : title}
        </Text>
      </View>
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
  const backpackProgress = visibleEntryCount ? Math.min(100, Math.round((selectedCount / visibleEntryCount) * 100)) : 0;

  function chooseUnit(nextUnitId: 'ALL' | string) {
    setUnitId(nextUnitId);
    setExpandedPackageId(null);
  }

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
        <Text selectable style={{ color: colors.inkMuted }}>Loading your A1 map…</Text>
      </View>
    );
  }
  if (!pair) {
    return <EmptyState title="Choose your languages" body="Set a language pair before starting the course adventure." action={<ActionButton label="Open settings" onPress={() => router.push('/settings')} />} />;
  }
  if (pair.targetLanguageCode !== 'en' || pair.referenceLanguageCode !== 'ar') {
    return <EmptyState title="English → Arabic for now" body="The reviewed A1 course catalog currently targets Arabic-speaking English learners. Change the active pair, or use manual add for another language pair." action={<ActionButton label="Open language settings" onPress={() => router.push('/settings')} />} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.md, gap: spacing.md, paddingBottom: selectedCount ? 126 : 38 }}
      >
        <Surface style={{ padding: spacing.lg, gap: spacing.md, backgroundColor: colors.ink }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.small, fontWeight: '900', letterSpacing: 1 }}>A1 ADVENTURE</Text>
              <Text accessibilityRole="header" selectable style={{ color: colors.surface, fontSize: 32, lineHeight: 36, fontWeight: '900' }}>
                Build your English deck
              </Text>
              <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.label, lineHeight: 20 }}>
                Explore six worlds, collect useful words and phrases, then train them in Swipe.
              </Text>
            </View>
            <View style={{ width: 66, height: 66, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Text aria-hidden style={{ fontSize: 34 }}>🎒</Text>
            </View>
          </View>

          <View style={{ gap: 7 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text selectable style={{ flex: 1, color: colors.surfaceMuted, fontSize: typography.small }}>Backpack</Text>
              <Text selectable style={{ color: colors.surface, fontSize: typography.small, fontWeight: '900' }}>{selectedCount} selected</Text>
            </View>
            <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: '#3D453A', overflow: 'hidden' }}>
              <View style={{ width: `${backpackProgress}%`, height: '100%', borderRadius: radius.pill, backgroundColor: '#F3C85B' }} />
            </View>
          </View>
        </Surface>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Chip>A1</Chip>
          <Text selectable style={{ flex: 1, color: colors.inkMuted, fontSize: typography.small }}>
            {READY_ENTRY_COUNT} app-ready entries · full locked A1 sync in progress
          </Text>
          <Chip>EN → AR</Chip>
        </View>

        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900' }}>Choose a world</Text>
              <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>Jump anywhere — nothing is locked.</Text>
            </View>
            <Text aria-hidden style={{ fontSize: 24 }}>✨</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.md }}>
            <WorldCard number={null} title="All worlds" selected={unitId === 'ALL'} onPress={() => chooseUnit('ALL')} />
            {CURRICULUM_UNITS.map((unit) => (
              <WorldCard key={unit.id} number={unit.number} title={unit.title} selected={unitId === unit.id} onPress={() => chooseUnit(unit.id)} />
            ))}
          </ScrollView>
        </View>

        <TextInput
          accessibilityLabel="Search course library"
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            if (value.trim()) setExpandedPackageId(null);
          }}
          placeholder="🔎  Find a word, phrase, or Arabic meaning…"
          placeholderTextColor={colors.inkMuted}
          style={{
            minHeight: 50,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            color: colors.ink,
            fontSize: typography.label,
          }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: spacing.sm }}>
            {(['ALL', 'WORD', 'PHRASE'] as const).map((value) => (
              <FilterChip
                key={value}
                label={value === 'ALL' ? 'All cards' : value === 'WORD' ? 'Words' : 'Phrases'}
                selected={kind === value}
                onPress={() => setKind(value)}
              />
            ))}
          </View>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>{visibleEntryCount} loot</Text>
        </View>

        {error ? (
          <Surface style={{ padding: spacing.md, backgroundColor: colors.dangerSurface }}>
            <Text accessibilityLiveRegion="polite" selectable style={{ color: colors.danger }}>{error}</Text>
          </Surface>
        ) : null}

        {result ? (
          <Surface style={{ padding: spacing.md, gap: spacing.sm, backgroundColor: colors.successSurface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text aria-hidden style={{ fontSize: 28 }}>🏆</Text>
              <View style={{ flex: 1 }}>
                <Text accessibilityLiveRegion="polite" selectable style={{ color: colors.success, fontSize: typography.label, fontWeight: '900' }}>Deck upgraded!</Text>
                <Text selectable style={{ color: colors.success, fontSize: typography.small, lineHeight: 18 }}>
                  {result.added} new · {result.reused} already owned · {result.collectionsCreated} mission collections created
                </Text>
              </View>
            </View>
            {result.failedItems.length ? <Text selectable style={{ color: colors.danger }}>Could not add: {result.failedItems.join(', ')}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <Pressable accessibilityRole="button" onPress={() => router.push('/bank')} style={({ pressed }) => ({ paddingVertical: 7, opacity: pressed ? 0.65 : 1 })}>
                <Text selectable style={{ color: colors.accent, fontSize: typography.label, fontWeight: '800' }}>Open deck →</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push('/')} style={({ pressed }) => ({ paddingVertical: 7, opacity: pressed ? 0.65 : 1 })}>
                <Text selectable style={{ color: colors.accent, fontSize: typography.label, fontWeight: '800' }}>Train in Swipe →</Text>
              </Pressable>
            </View>
          </Surface>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900' }}>Missions</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>Open a mission and collect the cards you want.</Text>
          </View>
          <Chip>{packages.length}</Chip>
        </View>

        {packages.length ? packages.map((pkg, index) => (
          <CoursePackageCard
            key={pkg.id}
            pkg={pkg}
            missionNumber={index + 1}
            expanded={expandedPackageId === pkg.id}
            selectedKeys={selectedKeys}
            onToggleExpanded={() => setExpandedPackageId((current) => current === pkg.id ? null : pkg.id)}
            onToggleItem={toggleItem}
            onToggleVisible={toggleVisible}
          />
        )) : (
          <Surface style={{ padding: spacing.lg }}>
            <Text aria-hidden style={{ textAlign: 'center', fontSize: 34 }}>🧩</Text>
            <Text selectable style={{ color: colors.inkMuted, textAlign: 'center', marginTop: spacing.sm }}>No mission matches these filters.</Text>
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
            <View style={{ minWidth: 110 }}>
              <Text selectable style={{ color: colors.ink, fontSize: typography.label, fontWeight: '900' }}>🎒 {selectedCount} cards</Text>
              <Pressable accessibilityRole="button" onPress={() => setSelectedKeys(new Set())}>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>Empty backpack</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton label={saving ? 'Collecting…' : 'Collect to Bank'} disabled={saving} onPress={() => void addSelected()} />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
