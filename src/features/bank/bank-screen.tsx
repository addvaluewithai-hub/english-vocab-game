import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { CatalogRepository, type BankFilter, type BankItem } from '@/data/catalog';
import { asSqlDatabase } from '@/data/database';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const FILTERS: readonly { value: BankFilter; label: string }[] = [
  { value: 'ALL', label: 'الكل' },
  { value: 'LEARNING', label: 'بتتعلمهم' },
  { value: 'STRONG', label: 'ثابتين' },
];

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

function lifecycleLabel(value: BankItem['lifecycle']): string {
  if (value === 'NEW') return 'جديدة';
  if (value === 'LEARNING') return 'بتتعلمها';
  if (value === 'STRONG') return 'ثابتة';
  return value;
}

function BankRow({ item }: { item: BankItem }) {
  return (
    <Link href={{ pathname: '/vocabulary/[cardId]', params: { cardId: item.cardId } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`افتح ${item.term}، ${item.translation}`}>
        <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text selectable numberOfLines={2} style={{ color: colors.ink, fontSize: 22, fontWeight: '900' }}>{item.term}</Text>
              <Text selectable numberOfLines={2} style={{ color: colors.inkMuted, fontSize: typography.body, ...rtlText }}>{item.translation}</Text>
            </View>
            <Chip>{lifecycleLabel(item.lifecycle)}</Chip>
          </View>
          {item.contextSentence ? <Text selectable numberOfLines={2} style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 20 }}>{item.contextSentence}</Text> : null}
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, ...rtlText }}>{item.reviewCount === 0 ? 'لسه مذاكرتهاش' : `راجعتها ${item.reviewCount} مرة`}</Text>
        </Surface>
      </Pressable>
    </Link>
  );
}

export function BankScreen() {
  const sqlite = useSQLiteContext();
  const { loading: pairLoading, pair } = useActiveLanguagePair();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<BankFilter>('ALL');
  const [items, setItems] = useState<BankItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!pair) {
        setItems([]);
        return;
      }
      try {
        const result = await new CatalogRepository(asSqlDatabase(sqlite)).listBank(pair.id, search, filter);
        if (!cancelled) {
          setItems(result);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'مقدرناش نفتح بنك الكلمات.');
      }
    }
    const timeout = setTimeout(() => void load(), search ? 120 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [filter, pair, search, sqlite]);

  if (pairLoading || items === null) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="بنحمّل كلماتك" /></View>;
  }
  if (!pair) {
    return <EmptyState title="بنجهز الإنجليزي" body="English → Arabic بيتعمل تلقائي أول ما تفتح التطبيق." />;
  }
  if (error) return <EmptyState title="كلماتك مش متاحة دلوقتي" body={error} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.cardId}
        renderItem={({ item }) => <BankRow item={item} />}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl }}
        initialNumToRender={18}
        windowSize={9}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', gap: spacing.md }}>
              <View style={{ flex: 1, gap: spacing.xs, alignItems: 'flex-end' }}>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontWeight: '800', ...rtlText }}>كلماتك</Text>
                <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '900', ...rtlText }}>بنك الكلمات</Text>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, ...rtlText }}>ظاهر {items.length} · English → Arabic</Text>
              </View>
              <Link href="/collections" asChild><ActionButton label="المجموعات" /></Link>
            </View>
            <TextInput
              accessibilityLabel="دوّر في كلماتك"
              value={search}
              onChangeText={setSearch}
              placeholder="دوّر بالكلمة أو المعنى أو المثال"
              placeholderTextColor={colors.inkMuted}
              autoCapitalize="none"
              returnKeyType="search"
              style={{ minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.ink, fontSize: typography.body, ...rtlText }}
            />
            <View accessibilityRole="tablist" style={{ flexDirection: 'row-reverse', gap: spacing.sm }}>
              {FILTERS.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: filter === option.value }}
                  onPress={() => setFilter(option.value)}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: filter === option.value ? colors.ink : colors.surfaceMuted }}
                >
                  <Text style={{ color: filter === option.value ? colors.surface : colors.inkMuted, fontWeight: '800', ...rtlText }}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState title={search || filter !== 'ALL' ? 'مفيش نتائج' : 'لسه بنكك فاضي'} body={search || filter !== 'ALL' ? 'جرّب كلمة بحث أو فلتر تاني.' : 'استخدم ضيف عشان تجيب كلمات من الكورس أو Gemini أو تضيف كلمة بإيدك.'} />}
      />
    </View>
  );
}
