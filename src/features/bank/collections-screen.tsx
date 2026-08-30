import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, EmptyState, Surface } from '@/components/primitives';
import { CatalogRepository, type CollectionSummary } from '@/data/catalog';
import { asSqlDatabase } from '@/data/database';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

async function readCollections(sqlite: SQLiteDatabase, languagePairId: string): Promise<CollectionSummary[]> {
  return new CatalogRepository(asSqlDatabase(sqlite)).listCollections(languagePairId);
}

export function CollectionsScreen() {
  const sqlite = useSQLiteContext();
  const { pair } = useActiveLanguagePair();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    if (!pair) return;
    setCollections(await readCollections(sqlite, pair.id));
  }

  useEffect(() => {
    if (!pair) return;
    let cancelled = false;

    void readCollections(sqlite, pair.id)
      .then((items) => {
        if (!cancelled) {
          setCollections(items);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'مقدرناش نفتح المجموعات دلوقتي.');
      });

    return () => {
      cancelled = true;
    };
  }, [pair, sqlite]);

  if (!pair) return <EmptyState title="بنجهز الإنجليزي" body="English → Arabic بيتعمل تلقائي أول ما تفتح التطبيق." />;
  const repo = new CatalogRepository(asSqlDatabase(sqlite));

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '900', ...rtlText }}>المجموعات</Text>
        <Text selectable style={{ color: colors.inkMuted, lineHeight: 22, ...rtlText }}>رتّب كلماتك في مجموعات من غير ما نكرر الكروت أو نضيّع تاريخ المذاكرة.</Text>
      </View>

      {error ? <Surface style={{ padding: spacing.md, backgroundColor: colors.dangerSurface }}><Text style={{ color: colors.danger, ...rtlText }}>{error}</Text></Surface> : null}

      <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text style={{ color: colors.ink, fontWeight: '900', ...rtlText }}>اعمل مجموعة جديدة</Text>
        <TextInput accessibilityLabel="اسم المجموعة" value={newName} onChangeText={setNewName} placeholder="مثلاً: إنجليزي الشغل" placeholderTextColor={colors.inkMuted} style={{ minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, ...rtlText }} />
        <ActionButton label="اعمل المجموعة" disabled={!newName.trim()} onPress={() => void repo.createCollection(pair.id, newName).then(() => { setNewName(''); return reload(); }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'مقدرناش نعمل المجموعة.'))} />
      </Surface>

      {collections.length ? collections.map((collection) => (
        <Surface key={collection.id} style={{ padding: spacing.md, gap: spacing.sm }}>
          {editingId === collection.id ? <TextInput accessibilityLabel="اسم المجموعة" autoFocus value={editingName} onChangeText={setEditingName} style={{ minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, ...rtlText }} /> : <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>{collection.name}</Text>}
          <Text selectable style={{ color: colors.inkMuted, ...rtlText }}>{collection.cardCount} كارت</Text>
          <View style={{ flexDirection: 'row-reverse', gap: spacing.sm }}>
            <View style={{ flex: 1 }}><ActionButton label={editingId === collection.id ? 'احفظ الاسم' : 'غيّر الاسم'} onPress={() => {
              if (editingId === collection.id) {
                void repo.renameCollection(collection.id, editingName).then(() => { setEditingId(null); return reload(); }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'مقدرناش نغيّر الاسم.'));
              } else {
                setEditingId(collection.id);
                setEditingName(collection.name);
              }
            }} /></View>
            <View style={{ flex: 1 }}><ActionButton label="أرشفها" tone="danger" onPress={() => Alert.alert('نأرشف المجموعة؟', 'الكلمات وتاريخ المراجعة هيفضلوا موجودين في بنك الكلمات.', [{ text: 'لا، سيبها', style: 'cancel' }, { text: 'أرشفها', style: 'destructive', onPress: () => void repo.archiveCollection(collection.id).then(reload) }])} /></View>
          </View>
        </Surface>
      )) : <EmptyState title="لسه مفيش مجموعات" body="اعمل مجموعة فوق لو عايز ترتب كلمات الشغل أو السفر أو أي موضوع تاني." />}
    </ScrollView>
  );
}
