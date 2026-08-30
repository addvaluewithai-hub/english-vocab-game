import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { CurriculumBankService, type CurriculumImportResult, type CurriculumSelection } from '@/curriculum/bank-service';
import {
  A1_CATALOG_STATS,
  CURRICULUM_PACKAGES,
  CURRICULUM_UNITS,
  curriculumSelectionKey,
  filterCurriculumPackages,
  type CurriculumKindFilter,
  type CurriculumPackage,
} from '@/curriculum/catalog';
import { CatalogRepository } from '@/data/catalog';
import { asSqlDatabase } from '@/data/database';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { CoursePackageCard } from './course-package-card';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

const WORLD_META: Record<number, { icon: string; shortTitle: string }> = {
  1: { icon: '👋', shortTitle: 'التعارف الأول' },
  2: { icon: '⏰', shortTitle: 'الناس والمواعيد' },
  3: { icon: '🏠', shortTitle: 'البيت والحاجات' },
  4: { icon: '🧭', shortTitle: 'الأماكن والسفر' },
  5: { icon: '🛍️', shortTitle: 'الخدمات والاحتياجات' },
  6: { icon: '💬', shortTitle: 'الرسائل والتواصل' },
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
      <Text selectable numberOfLines={1} style={{ color: selected ? colors.surface : colors.inkMuted, fontSize: typography.small, fontWeight: '800', ...rtlText }}>
        {label}
      </Text>
    </Pressable>
  );
}

function WorldCard({ number, title, missionCount, selected, onPress }: {
  number: number | null;
  title: string;
  missionCount: number;
  selected: boolean;
  onPress: () => void;
}) {
  const meta = number ? (WORLD_META[number] ?? { icon: '⭐', shortTitle: title }) : { icon: '🗺️', shortTitle: title };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 142,
        minHeight: 112,
        padding: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.ink : colors.surface,
        opacity: pressed ? 0.74 : 1,
        justifyContent: 'space-between',
      })}
    >
      <Text aria-hidden style={{ fontSize: 30, textAlign: 'right' }}>{meta.icon}</Text>
      <View style={{ gap: 2, alignItems: 'flex-end' }}>
        <Text selectable style={{ color: selected ? colors.surfaceMuted : colors.inkMuted, fontSize: 10, fontWeight: '900', ...rtlText }}>
          {number ? `العالم ${number}` : 'كل العوالم'} · {missionCount} مهمة
        </Text>
        <Text selectable numberOfLines={2} style={{ color: selected ? colors.surface : colors.ink, fontSize: typography.small, fontWeight: '900', lineHeight: 17, ...rtlText }}>
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

export function CourseLibraryScreen() {
  const router = useRouter();
  const sqlite = useSQLiteContext();
  const { loading: pairLoading, pair } = useActiveLanguagePair();
  const [unitId, setUnitId] = useState<'ALL' | string>('ALL');
  const [kind, setKind] = useState<CurriculumKindFilter>('ALL');
  const [query, setQuery] = useState('');
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [usedPackageIds, setUsedPackageIds] = useState<Set<string>>(() => new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CurriculumImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshUsedPackages(languagePairId: string) {
    const collections = await new CatalogRepository(asSqlDatabase(sqlite)).listCollections(languagePairId);
    const next = new Set<string>();
    for (const pkg of CURRICULUM_PACKAGES) {
      const marker = `· curated from English Course · ${pkg.id}`;
      if (collections.some((collection) => collection.cardCount > 0 && collection.description?.includes(marker))) {
        next.add(pkg.id);
      }
    }
    setUsedPackageIds(next);
  }

  useEffect(() => {
    let cancelled = false;
    if (!pair) return () => { cancelled = true; };
    void new CatalogRepository(asSqlDatabase(sqlite)).listCollections(pair.id).then((collections) => {
      if (cancelled) return;
      const next = new Set<string>();
      for (const pkg of CURRICULUM_PACKAGES) {
        const marker = `· curated from English Course · ${pkg.id}`;
        if (collections.some((collection) => collection.cardCount > 0 && collection.description?.includes(marker))) next.add(pkg.id);
      }
      setUsedPackageIds(next);
    });
    return () => { cancelled = true; };
  }, [pair, sqlite]);

  const packages = useMemo(
    () => filterCurriculumPackages({ level: 'A1', unitId, kind, query }),
    [kind, query, unitId],
  );
  const newPackages = packages.filter((pkg) => !usedPackageIds.has(pkg.id));
  const completedPackages = packages.filter((pkg) => usedPackageIds.has(pkg.id));
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

  function toggleVisible(pkg: CurriculumPackage, select: boolean) {
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
      const selections = buildSelections(selectedKeys);
      const imported = await new CurriculumBankService(sqlite).addSelections(pair.id, selections);
      setResult(imported);
      await refreshUsedPackages(pair.id);
      if (!imported.failedItems.length) setSelectedKeys(new Set());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'مقدرناش نضيف الكلمات اللي اخترتها.');
    } finally {
      setSaving(false);
    }
  }

  if (pairLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <Text selectable style={{ color: colors.inkMuted, ...rtlText }}>بنجهز مغامرة A1…</Text>
      </View>
    );
  }
  if (!pair) {
    return <EmptyState title="بنجهز الإنجليزي" body="English → Arabic بيتعمل تلقائي أول ما تفتح التطبيق." />;
  }
  if (pair.targetLanguageCode !== 'en' || pair.referenceLanguageCode !== 'ar') {
    return <EmptyState title="كورس English → Arabic" body="الكورس ده معمول حاليًا للي بيتعلم إنجليزي بالعربي." action={<ActionButton label="استخدم English → Arabic" onPress={() => router.push('/settings')} />} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.md, gap: spacing.md, paddingBottom: selectedCount ? 126 : 38 }}
      >
        <Surface style={{ padding: spacing.lg, gap: spacing.md, backgroundColor: colors.ink }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.md }}>
            <View style={{ flex: 1, gap: spacing.xs, alignItems: 'flex-end' }}>
              <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.small, fontWeight: '900', ...rtlText }}>مغامرة A1</Text>
              <Text accessibilityRole="header" selectable style={{ color: colors.surface, fontSize: 32, lineHeight: 39, fontWeight: '900', ...rtlText }}>
                اختار مهمتك الجاية
              </Text>
              <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.label, lineHeight: 22, ...rtlText }}>
                اختار عالم، افتح مهمة، وخد منها الكلمات والعبارات اللي إنت فعلًا عايز تذاكرها.
              </Text>
            </View>
            <View style={{ width: 66, height: 66, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Text aria-hidden style={{ fontSize: 34 }}>🎒</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm }}>
            <Chip>{CURRICULUM_UNITS.length} عوالم</Chip>
            <Chip>{A1_CATALOG_STATS.missionCount} مهمة</Chip>
            <Chip>{usedPackageIds.size} خلصتهم</Chip>
          </View>

          <View style={{ gap: 7 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
              <Text selectable style={{ flex: 1, color: colors.surfaceMuted, fontSize: typography.small, ...rtlText }}>الشنطة</Text>
              <Text selectable style={{ color: colors.surface, fontSize: typography.small, fontWeight: '900', ...rtlText }}>مختار {selectedCount}</Text>
            </View>
            <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: '#3D453A', overflow: 'hidden' }}>
              <View style={{ width: `${backpackProgress}%`, height: '100%', borderRadius: radius.pill, backgroundColor: '#F3C85B' }} />
            </View>
          </View>
        </Surface>

        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
          <Chip>A1</Chip>
          <Text selectable style={{ flex: 1, color: colors.inkMuted, fontSize: typography.small, ...rtlText }}>
            English → Arabic · جربت {usedPackageIds.size} من {A1_CATALOG_STATS.missionCount} مهمة
          </Text>
        </View>

        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>اختار عالم</Text>
              <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, ...rtlText }}>ابدأ من أي مكان. المهمات اللي استخدمتها بتتنقل لوحدها لقسم المخلص.</Text>
            </View>
            <Text aria-hidden style={{ fontSize: 24 }}>✨</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.md }}>
            <WorldCard number={null} title="كل العوالم" missionCount={A1_CATALOG_STATS.missionCount} selected={unitId === 'ALL'} onPress={() => chooseUnit('ALL')} />
            {CURRICULUM_UNITS.map((unit) => (
              <WorldCard key={unit.id} number={unit.number} title={unit.title} missionCount={unit.missionCount} selected={unitId === unit.id} onPress={() => chooseUnit(unit.id)} />
            ))}
          </ScrollView>
        </View>

        <TextInput
          accessibilityLabel="دوّر في الكورس"
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            if (value.trim()) setExpandedPackageId(null);
          }}
          placeholder="🔎  دور على مهمة، كلمة، عبارة أو معنى…"
          placeholderTextColor={colors.inkMuted}
          style={{ minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.ink, fontSize: typography.label, ...rtlText }}
        />

        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1, flexDirection: 'row-reverse', gap: spacing.sm }}>
            {(['ALL', 'WORD', 'PHRASE'] as const).map((value) => (
              <FilterChip
                key={value}
                label={value === 'ALL' ? 'الكل' : value === 'WORD' ? 'كلمات' : 'عبارات'}
                selected={kind === value}
                onPress={() => setKind(value)}
              />
            ))}
          </View>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, ...rtlText }}>{visibleEntryCount} متاح</Text>
        </View>

        {error ? (
          <Surface style={{ padding: spacing.md, backgroundColor: colors.dangerSurface }}>
            <Text accessibilityLiveRegion="polite" selectable style={{ color: colors.danger, ...rtlText }}>{error}</Text>
          </Surface>
        ) : null}

        {result ? (
          <Surface style={{ padding: spacing.md, gap: spacing.sm, backgroundColor: colors.successSurface }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
              <Text aria-hidden style={{ fontSize: 28 }}>🏆</Text>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text accessibilityLiveRegion="polite" selectable style={{ color: colors.success, fontSize: typography.label, fontWeight: '900', ...rtlText }}>اتضافوا لكلماتك!</Text>
                <Text selectable style={{ color: colors.success, fontSize: typography.small, lineHeight: 18, ...rtlText }}>
                  {result.added} جديد · {result.reused} كانوا موجودين عندك
                </Text>
              </View>
            </View>
            {result.failedItems.length ? <Text selectable style={{ color: colors.danger, ...rtlText }}>معرفناش نضيف: {result.failedItems.join(', ')}</Text> : null}
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm }}>
              <Pressable accessibilityRole="button" onPress={() => router.push('/bank')} style={({ pressed }) => ({ paddingVertical: 7, opacity: pressed ? 0.65 : 1 })}>
                <Text selectable style={{ color: colors.accent, fontSize: typography.label, fontWeight: '800', ...rtlText }}>افتح كلماتي ←</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push('/study')} style={({ pressed }) => ({ paddingVertical: 7, opacity: pressed ? 0.65 : 1 })}>
                <Text selectable style={{ color: colors.accent, fontSize: typography.label, fontWeight: '800', ...rtlText }}>ابدأ مذاكرة ←</Text>
              </Pressable>
            </View>
          </Surface>
        ) : null}

        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>لسه قدامك</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, ...rtlText }}>مهمات لسه ماخدتش منها كلمات.</Text>
          </View>
          <Chip>{newPackages.length}</Chip>
        </View>

        {newPackages.length ? newPackages.map((pkg) => (
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
            <Text aria-hidden style={{ textAlign: 'center', fontSize: 34 }}>🎉</Text>
            <Text selectable style={{ color: colors.inkMuted, textAlign: 'center', marginTop: spacing.sm, writingDirection: 'rtl' }}>مفيش مهمة جديدة مطابقة للفلاتر دي.</Text>
          </Surface>
        )}

        {completedPackages.length ? (
          <View style={{ gap: spacing.sm }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showCompleted }}
              onPress={() => setShowCompleted((value) => !value)}
              style={({ pressed }) => ({
                flexDirection: 'row-reverse',
                alignItems: 'center',
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                backgroundColor: colors.surfaceMuted,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text selectable style={{ color: colors.ink, fontSize: typography.body, fontWeight: '900', ...rtlText }}>✓ المهمات اللي استخدمتها</Text>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, ...rtlText }}>{completedPackages.length} مهمة خدت منها كلمات · دوس عشان {showCompleted ? 'تخفيهم' : 'تشوفهم'}</Text>
              </View>
              <Text aria-hidden style={{ color: colors.ink, fontSize: 22 }}>{showCompleted ? '−' : '+'}</Text>
            </Pressable>

            {showCompleted ? completedPackages.map((pkg) => (
              <CoursePackageCard
                key={`completed-${pkg.id}`}
                pkg={pkg}
                expanded={expandedPackageId === pkg.id}
                selectedKeys={selectedKeys}
                onToggleExpanded={() => setExpandedPackageId((current) => current === pkg.id ? null : pkg.id)}
                onToggleItem={toggleItem}
                onToggleVisible={toggleVisible}
              />
            )) : null}
          </View>
        ) : null}
      </ScrollView>

      {selectedCount ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
          <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md }}>
            <View style={{ minWidth: 110, alignItems: 'flex-end' }}>
              <Text selectable style={{ color: colors.ink, fontSize: typography.label, fontWeight: '900', ...rtlText }}>🎒 {selectedCount} كارت</Text>
              <Pressable accessibilityRole="button" onPress={() => setSelectedKeys(new Set())}>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, ...rtlText }}>فضّي الشنطة</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton label={saving ? 'بنضيف…' : 'ضيفهم لكلماتي'} disabled={saving} onPress={() => void addSelected()} />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
