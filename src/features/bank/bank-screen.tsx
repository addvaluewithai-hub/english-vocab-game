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
  { value: 'ALL', label: 'All' },
  { value: 'LEARNING', label: 'Learning' },
  { value: 'STRONG', label: 'Strong' },
];

function BankRow({ item }: { item: BankItem }) {
  return (
    <Link href={{ pathname: '/vocabulary/[cardId]', params: { cardId: item.cardId } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.term}, ${item.translation}`}>
        <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text selectable numberOfLines={2} style={{ color: colors.ink, fontSize: 22, fontWeight: '900' }}>{item.term}</Text>
              <Text selectable numberOfLines={2} style={{ color: colors.inkMuted, fontSize: typography.body }}>{item.translation}</Text>
            </View>
            <Chip>{item.lifecycle === 'NEW' ? 'NEW' : item.lifecycle}</Chip>
          </View>
          {item.contextSentence ? <Text selectable numberOfLines={2} style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 20 }}>{item.contextSentence}</Text> : null}
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>{item.reviewCount === 0 ? 'Not studied yet' : `${item.reviewCount} review${item.reviewCount === 1 ? '' : 's'}`}</Text>
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
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load the vocabulary bank.');
      }
    }
    const timeout = setTimeout(() => void load(), search ? 120 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [filter, pair, search, sqlite]);

  if (pairLoading || items === null) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="Loading vocabulary bank" /></View>;
  }
  if (!pair) {
    return <EmptyState title="Preparing English" body="English → Arabic is created automatically on first launch." />;
  }
  if (error) return <EmptyState title="Bank unavailable" body={error} />;

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
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontWeight: '800' }}>YOUR WORDS</Text>
                <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '900' }}>Vocabulary Bank</Text>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label }}>{items.length} shown · {pair.targetLanguageName} → {pair.referenceLanguageName}</Text>
              </View>
              <Link href="/collections" asChild><ActionButton label="Collections" /></Link>
            </View>
            <TextInput
              accessibilityLabel="Search vocabulary"
              value={search}
              onChangeText={setSearch}
              placeholder="Search word, meaning or example"
              placeholderTextColor={colors.inkMuted}
              autoCapitalize="none"
              returnKeyType="search"
              style={{ minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.ink, fontSize: typography.body }}
            />
            <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: spacing.sm }}>
              {FILTERS.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: filter === option.value }}
                  onPress={() => setFilter(option.value)}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: filter === option.value ? colors.ink : colors.surfaceMuted }}
                >
                  <Text style={{ color: filter === option.value ? colors.surface : colors.inkMuted, fontWeight: '800' }}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState title={search || filter !== 'ALL' ? 'No matches' : 'Your bank is empty'} body={search || filter !== 'ALL' ? 'Try a different search or filter.' : 'Use Add to bring in course words, Smart Import, or one word at a time.'} />}
      />
    </View>
  );
}
