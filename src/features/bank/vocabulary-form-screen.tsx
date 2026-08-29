import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { CatalogRepository, ManualVocabularyService, type CollectionSummary } from '@/data/catalog';
import { asSqlDatabase } from '@/data/database';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import type { TermKind } from '@/domain/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';

function Field({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.ink, fontSize: typography.label, fontWeight: '700' }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{ minHeight: multiline ? 92 : 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.ink, fontSize: typography.body }}
      />
    </View>
  );
}

export function VocabularyFormScreen() {
  const { cardId } = useLocalSearchParams<{ cardId?: string }>();
  const router = useRouter();
  const sqlite = useSQLiteContext();
  const { loading: pairLoading, pair } = useActiveLanguagePair();
  const [term, setTerm] = useState('');
  const [kind, setKind] = useState<TermKind>('WORD');
  const [translation, setTranslation] = useState('');
  const [definition, setDefinition] = useState('');
  const [context, setContext] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [exampleTranslation, setExampleTranslation] = useState('');
  const [note, setNote] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(cardId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!pair) return;
      const repo = new CatalogRepository(asSqlDatabase(sqlite));
      const list = await repo.listCollections(pair.id);
      if (cancelled) return;
      setCollections(list);
      if (cardId) {
        const detail = await repo.getDetail(cardId);
        if (!detail) throw new Error('Vocabulary item not found.');
        setTerm(detail.term);
        setKind(detail.termKind);
        setTranslation(detail.translation);
        setDefinition(detail.definition ?? '');
        setContext(detail.contexts[0]?.sentence ?? '');
        setPartOfSpeech(detail.partOfSpeech ?? '');
        setPronunciation(detail.pronunciationText ?? '');
        setExampleTranslation(detail.exampleTranslation ?? '');
        setNote(detail.note ?? '');
        setSelectedCollections(detail.collections.map((item) => item.id));
        setAdvanced(Boolean(detail.definition || detail.partOfSpeech || detail.pronunciationText || detail.exampleTranslation || detail.note));
      }
      setLoading(false);
    }
    void load().catch((caught: unknown) => {
      if (!cancelled) {
        setError(caught instanceof Error ? caught.message : 'Could not load the form.');
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [cardId, pair, sqlite]);

  async function save() {
    if (!pair || saving) return;
    setSaving(true);
    setError(null);
    try {
      const service = new ManualVocabularyService(sqlite);
      if (cardId) {
        await service.edit(cardId, { term, translation, definition, contextSentence: context, partOfSpeech, pronunciationText: pronunciation, exampleTranslation, note });
        const repo = new CatalogRepository(asSqlDatabase(sqlite));
        const existing = await repo.getDetail(cardId);
        const old = new Set(existing?.collections.map((item) => item.id) ?? []);
        for (const id of selectedCollections) if (!old.has(id)) await repo.addToCollection(cardId, id);
        for (const id of old) if (!selectedCollections.includes(id)) await repo.removeFromCollection(cardId, id);
        router.replace({ pathname: '/vocabulary/[cardId]', params: { cardId } });
      } else {
        const result = await service.create({ languagePairId: pair.id, term, kind, translation, definition, contextSentence: context, partOfSpeech, pronunciationText: pronunciation, exampleTranslation, note, collectionIds: selectedCollections });
        router.replace({ pathname: '/vocabulary/[cardId]', params: { cardId: result.cardId } });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save vocabulary.');
    } finally {
      setSaving(false);
    }
  }

  if (pairLoading || loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator /></View>;
  if (!pair) return <EmptyState title="Preparing English" body="English → Arabic is created automatically on first launch." />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>{cardId ? 'Edit vocabulary' : 'Add vocabulary'}</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label }}>{pair.targetLanguageName} → {pair.referenceLanguageName}</Text>
      </View>
      {!cardId ? (
        <View style={{ gap: spacing.md }}>
          <Surface style={{ padding: spacing.md, gap: spacing.sm, backgroundColor: colors.ink }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
              <Text aria-hidden style={{ fontSize: 31 }}>📸</Text>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text selectable style={{ color: colors.surface, fontSize: 19, fontWeight: '900' }}>Import from an image</Text>
                <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.label, lineHeight: 21 }}>Take a photo or choose screenshots. AI extracts the English, translates it, and writes example sentences for review.</Text>
              </View>
            </View>
            <ActionButton label="Import image with AI" onPress={() => router.push('/image-import')} />
          </Surface>

          <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
            <View style={{ gap: spacing.xs }}>
              <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: '800' }}>Choose from the English Course</Text>
              <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 21 }}>Browse A1 missions, collect useful vocabulary and phrases, then train them in the same Bank.</Text>
            </View>
            <ActionButton label="Browse course library" onPress={() => router.push('/course-library')} />
          </Surface>
        </View>
      ) : null}
      {error ? <Surface style={{ padding: spacing.md, backgroundColor: colors.dangerSurface }}><Text selectable style={{ color: colors.danger }}>{error}</Text></Surface> : null}
      <Field label="Term or phrase" value={term} onChangeText={setTerm} placeholder="e.g. look forward to" />
      {!cardId ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {(['WORD', 'PHRASE'] as const).map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: kind === value }} onPress={() => setKind(value)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: kind === value ? colors.accent : colors.surfaceMuted }}><Text style={{ color: kind === value ? colors.surface : colors.inkMuted, fontWeight: '700' }}>{value === 'WORD' ? 'Word' : 'Phrase'}</Text></Pressable>)}
        </View>
      ) : null}
      <Field label="Meaning / translation" value={translation} onChangeText={setTranslation} placeholder="The meaning you want to recall" />
      <Field label="Context sentence" value={context} onChangeText={setContext} placeholder="Where you saw or would use it" multiline />
      <Pressable accessibilityRole="button" onPress={() => setAdvanced((value) => !value)}><Text style={{ color: colors.accent, fontWeight: '800', fontSize: typography.body }}>{advanced ? 'Hide optional details' : 'Add optional details'}</Text></Pressable>
      {advanced ? <View style={{ gap: spacing.md }}>
        <Field label="Definition" value={definition} onChangeText={setDefinition} multiline />
        <Field label="Part of speech" value={partOfSpeech} onChangeText={setPartOfSpeech} placeholder="noun, verb, adjective…" />
        <Field label="Pronunciation" value={pronunciation} onChangeText={setPronunciation} placeholder="IPA or a helpful hint" />
        <Field label="Example translation" value={exampleTranslation} onChangeText={setExampleTranslation} multiline />
        <Field label="Note" value={note} onChangeText={setNote} multiline />
      </View> : null}
      {collections.length ? <View style={{ gap: spacing.sm }}><Text style={{ color: colors.ink, fontWeight: '800' }}>Collections</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{collections.map((collection) => { const selected = selectedCollections.includes(collection.id); return <Pressable key={collection.id} onPress={() => setSelectedCollections((current) => selected ? current.filter((id) => id !== collection.id) : [...current, collection.id])}><Chip>{selected ? '✓ ' : ''}{collection.name}</Chip></Pressable>; })}</View></View> : null}
      <ActionButton label={saving ? 'Saving…' : cardId ? 'Save changes' : 'Add to bank'} disabled={saving || !term.trim() || !translation.trim()} onPress={() => void save()} />
    </ScrollView>
  );
}
