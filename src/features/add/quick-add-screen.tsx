import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { enrichVocabularyWithGemini } from '@/ai/vocabulary-enrichment';
import { ActionButton, EmptyState, Surface } from '@/components/primitives';
import { ManualVocabularyService } from '@/data/catalog';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import type { TermKind } from '@/domain/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';

function Field({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.ink, fontSize: typography.label, fontWeight: '800' }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{ minHeight: multiline ? 88 : 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.ink, fontSize: typography.body }}
      />
    </View>
  );
}

export function QuickAddScreen() {
  const router = useRouter();
  const sqlite = useSQLiteContext();
  const { loading, pair } = useActiveLanguagePair();
  const [term, setTerm] = useState('');
  const [kind, setKind] = useState<TermKind>('WORD');
  const [translation, setTranslation] = useState('');
  const [context, setContext] = useState('');
  const [definition, setDefinition] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [exampleTranslation, setExampleTranslation] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fillWithGemini() {
    if (!term.trim() || thinking) return;
    setThinking(true);
    setError(null);
    setMessage(null);
    try {
      const suggestion = await enrichVocabularyWithGemini(term, kind);
      setTranslation(suggestion.translation);
      setContext(suggestion.contextSentence);
      setDefinition(suggestion.definition);
      setPartOfSpeech(suggestion.partOfSpeech);
      setExampleTranslation(suggestion.exampleTranslation);
      setMessage('Gemini filled the meaning and example. Edit anything before saving.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gemini could not fill this word right now.');
    } finally {
      setThinking(false);
    }
  }

  async function save() {
    if (!pair || !term.trim() || !translation.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await new ManualVocabularyService(sqlite).create({
        languagePairId: pair.id,
        term,
        kind,
        translation,
        definition,
        contextSentence: context,
        partOfSpeech,
        pronunciationText: '',
        exampleTranslation,
        note: '',
        collectionIds: [],
      });
      router.replace({ pathname: '/vocabulary/[cardId]', params: { cardId: result.cardId } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add this vocabulary item.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><Text style={{ color: colors.inkMuted }}>Preparing…</Text></View>;
  if (!pair) return <EmptyState title="Preparing English" body="English → Arabic is created automatically on first launch." />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ width: '100%', maxWidth: 680, alignSelf: 'center', padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontWeight: '800' }}>QUICK ADD</Text>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: '900' }}>Add one word or phrase</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 23 }}>Type it once. Gemini can fill the Arabic meaning and a natural example for you.</Text>
      </View>

      {error ? <Surface style={{ padding: spacing.md, backgroundColor: colors.dangerSurface }}><Text selectable style={{ color: colors.danger }}>{error}</Text></Surface> : null}

      <Field label="English word or phrase" value={term} onChangeText={(value) => { setTerm(value); setMessage(null); }} placeholder="e.g. look forward to" />

      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: spacing.sm }}>
        {(['WORD', 'PHRASE'] as const).map((value) => {
          const selected = kind === value;
          return (
            <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setKind(value)} style={{ paddingHorizontal: 15, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: selected ? colors.ink : colors.surfaceMuted }}>
              <Text style={{ color: selected ? colors.surface : colors.inkMuted, fontWeight: '800' }}>{value === 'WORD' ? 'Word' : 'Phrase'}</Text>
            </Pressable>
          );
        })}
      </View>

      <Surface style={{ padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surfaceMuted }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Text aria-hidden style={{ fontSize: 28 }}>✨</Text>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>Let Gemini fill it</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 18 }}>Meaning, definition and a natural example.</Text>
          </View>
        </View>
        <ActionButton label={thinking ? 'Thinking…' : 'Fill with Gemini'} disabled={thinking || !term.trim()} onPress={() => void fillWithGemini()} />
        {message ? <Text selectable style={{ color: colors.success, fontSize: typography.small, fontWeight: '700' }}>{message}</Text> : null}
      </Surface>

      <Field label="Arabic meaning" value={translation} onChangeText={setTranslation} placeholder="المعنى" />
      <Field label="Example sentence" value={context} onChangeText={setContext} placeholder="A natural sentence using the word" multiline />

      <Pressable onPress={() => setShowMore((value) => !value)}>
        <Text style={{ color: colors.accent, fontSize: typography.label, fontWeight: '800' }}>{showMore ? 'Hide extra details' : 'Show extra details'}</Text>
      </Pressable>

      {showMore ? (
        <View style={{ gap: spacing.md }}>
          <Field label="Definition" value={definition} onChangeText={setDefinition} multiline />
          <Field label="Part of speech" value={partOfSpeech} onChangeText={setPartOfSpeech} placeholder="noun, verb, adjective…" />
          <Field label="Example translation" value={exampleTranslation} onChangeText={setExampleTranslation} multiline />
        </View>
      ) : null}

      <ActionButton label={saving ? 'Adding…' : 'Add to Bank'} disabled={saving || !term.trim() || !translation.trim()} onPress={() => void save()} />
    </ScrollView>
  );
}
