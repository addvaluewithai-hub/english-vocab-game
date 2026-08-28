import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, EmptyState, Surface } from '@/components/primitives';
import { CatalogRepository, type CollectionSummary } from '@/data/catalog';
import { asSqlDatabase } from '@/data/database';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { colors, radius, spacing, typography } from '@/theme/tokens';

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
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load collections.');
      });

    return () => {
      cancelled = true;
    };
  }, [pair, sqlite]);

  if (!pair) return <EmptyState title="No active language pair" body="Choose your languages in Settings first." />;
  const repo = new CatalogRepository(asSqlDatabase(sqlite));

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs }}><Text selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>Collections</Text><Text selectable style={{ color: colors.inkMuted }}>Organize cards without duplicating their learning state.</Text></View>
      {error ? <Surface style={{ padding: spacing.md, backgroundColor: colors.dangerSurface }}><Text style={{ color: colors.danger }}>{error}</Text></Surface> : null}
      <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text style={{ color: colors.ink, fontWeight: '800' }}>New collection</Text>
        <TextInput value={newName} onChangeText={setNewName} placeholder="e.g. Work English" placeholderTextColor={colors.inkMuted} style={{ minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink }} />
        <ActionButton label="Create collection" disabled={!newName.trim()} onPress={() => void repo.createCollection(pair.id, newName).then(() => { setNewName(''); return reload(); }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not create collection.'))} />
      </Surface>
      {collections.map((collection) => (
        <Surface key={collection.id} style={{ padding: spacing.md, gap: spacing.sm }}>
          {editingId === collection.id ? <TextInput autoFocus value={editingName} onChangeText={setEditingName} style={{ minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink }} /> : <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>{collection.name}</Text>}
          <Text selectable style={{ color: colors.inkMuted }}>{collection.cardCount} cards</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}><ActionButton label={editingId === collection.id ? 'Save name' : 'Rename'} onPress={() => {
              if (editingId === collection.id) {
                void repo.renameCollection(collection.id, editingName).then(() => { setEditingId(null); return reload(); }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not rename.'));
              } else { setEditingId(collection.id); setEditingName(collection.name); }
            }} /></View>
            <View style={{ flex: 1 }}><ActionButton label="Archive" tone="danger" onPress={() => Alert.alert('Archive collection?', 'Cards and review history will stay in your bank.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: () => void repo.archiveCollection(collection.id).then(reload) }])} /></View>
          </View>
        </Surface>
      ))}
    </ScrollView>
  );
}
