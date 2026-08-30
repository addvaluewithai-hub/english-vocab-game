import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { enrichVocabularyWithGemini } from '@/ai/vocabulary-enrichment';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { CatalogRepository, ManualVocabularyService, type CollectionSummary } from '@/data/catalog';
import { asSqlDatabase } from '@/data/database';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import type { TermKind } from '@/domain/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

function Field({ label, value, onChangeText, placeholder, multiline = false, rtl = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean; rtl?: boolean }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.ink, fontSize: typography.label, fontWeight: '800', ...rtlText }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{ minHeight: multiline ? 92 : 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.ink, fontSize: typography.body, ...(rtl ? rtlText : {}) }}
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
  const [aiFilling, setAiFilling] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
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
        if (!detail) throw new Error('الكلمة دي مش موجودة.');
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
        setError(caught instanceof Error ? caught.message : 'مقدرناش نفتح بيانات الكلمة.');
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [cardId, pair, sqlite]);

  async function fillWithGemini() {
    if (!term.trim() || aiFilling) return;
    setAiFilling(true);
    setAiMessage(null);
    setError(null);
    try {
      const suggestion = await enrichVocabularyWithGemini(term, kind);
      setTranslation(suggestion.translation);
      setDefinition(suggestion.definition);
      setContext(suggestion.contextSentence);
      setPartOfSpeech(suggestion.partOfSpeech);
      setExampleTranslation(suggestion.exampleTranslation);
      setAdvanced(true);
      setAiMessage(suggestion.fallbackCount > 0
        ? `Gemini ظبطها بعد ما جرّب ${suggestion.fallbackCount + 1} موديل.`
        : 'Gemini ظبط لك المعنى والمثال. راجعهم وعدّل براحتك.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gemini معرفش يكمل الكلمة دلوقتي. جرّب تاني.');
    } finally {
      setAiFilling(false);
    }
  }

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
      setError(caught instanceof Error ? caught.message : 'مقدرناش نحفظ الكلمة. جرّب تاني.');
    } finally {
      setSaving(false);
    }
  }

  if (pairLoading || loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="بنفتح بيانات الكلمة" /></View>;
  if (!pair) return <EmptyState title="بنجهز الإنجليزي" body="English → Arabic بيتعمل تلقائي أول ما تفتح التطبيق." />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '900', ...rtlText }}>{cardId ? 'عدّل الكلمة' : 'ضيف كلمة'}</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, ...rtlText }}>إنجليزي → عربي</Text>
      </View>

      {error ? <Surface style={{ padding: spacing.md, backgroundColor: colors.dangerSurface }}><Text selectable style={{ color: colors.danger, ...rtlText }}>{error}</Text></Surface> : null}

      <Field label="الكلمة أو العبارة بالإنجليزي" value={term} onChangeText={(value) => { setTerm(value); setAiMessage(null); }} placeholder="مثلاً: look forward to" />

      {!cardId ? (
        <View style={{ flexDirection: 'row-reverse', gap: spacing.sm }}>
          {(['WORD', 'PHRASE'] as const).map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: kind === value }} onPress={() => setKind(value)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: kind === value ? colors.accent : colors.surfaceMuted }}><Text style={{ color: kind === value ? colors.surface : colors.inkMuted, fontWeight: '700', ...rtlText }}>{value === 'WORD' ? 'كلمة' : 'عبارة'}</Text></Pressable>)}
        </View>
      ) : null}

      <Surface style={{ padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surfaceMuted }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.sm }}>
          <Text aria-hidden style={{ fontSize: 28 }}>✨</Text>
          <View style={{ flex: 1, gap: 3, alignItems: 'flex-end' }}>
            <Text selectable style={{ color: colors.ink, fontWeight: '900', fontSize: 18, ...rtlText }}>خلي Gemini يكملها</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 20, ...rtlText }}>اكتب الإنجليزي بس، وهو يقترح المعنى بالعربي والتعريف ومثال طبيعي. كل حاجة تقدر تعدّلها قبل الحفظ.</Text>
          </View>
        </View>
        <ActionButton label={aiFilling ? 'بيفكر…' : 'كمّل بـ Gemini'} disabled={aiFilling || !term.trim()} onPress={() => void fillWithGemini()} />
        {aiMessage ? <Text selectable style={{ color: colors.success, fontSize: typography.small, fontWeight: '700', ...rtlText }}>{aiMessage}</Text> : null}
      </Surface>

      <Field label="المعنى بالعربي" value={translation} onChangeText={setTranslation} placeholder="المعنى اللي عايز تفتكره" rtl />
      <Field label="مثال بالإنجليزي" value={context} onChangeText={setContext} placeholder="جملة طبيعية تستخدم فيها الكلمة" multiline />

      <Pressable accessibilityRole="button" onPress={() => setAdvanced((value) => !value)}><Text style={{ color: colors.accent, fontWeight: '800', fontSize: typography.body, ...rtlText }}>{advanced ? 'اخفي التفاصيل الزيادة' : 'وريني تفاصيل أكتر'}</Text></Pressable>

      {advanced ? <View style={{ gap: spacing.md }}>
        <Field label="التعريف بالإنجليزي" value={definition} onChangeText={setDefinition} multiline />
        <Field label="نوع الكلمة" value={partOfSpeech} onChangeText={setPartOfSpeech} placeholder="noun, verb, adjective…" />
        <Field label="النطق" value={pronunciation} onChangeText={setPronunciation} placeholder="IPA أو أي ملاحظة تساعدك في النطق" />
        <Field label="ترجمة المثال" value={exampleTranslation} onChangeText={setExampleTranslation} multiline rtl />
        <Field label="ملاحظتك" value={note} onChangeText={setNote} multiline rtl />
      </View> : null}

      {collections.length ? <View style={{ gap: spacing.sm, alignItems: 'flex-end' }}><Text style={{ color: colors.ink, fontWeight: '800', ...rtlText }}>المجموعات</Text><View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm }}>{collections.map((collection) => { const selected = selectedCollections.includes(collection.id); return <Pressable key={collection.id} onPress={() => setSelectedCollections((current) => selected ? current.filter((id) => id !== collection.id) : [...current, collection.id])}><Chip>{selected ? '✓ ' : ''}{collection.name}</Chip></Pressable>; })}</View></View> : null}

      <ActionButton label={saving ? 'بنحفظ…' : cardId ? 'احفظ التعديلات' : 'ضيفها لكلماتي'} disabled={saving || !term.trim() || !translation.trim()} onPress={() => void save()} />
    </ScrollView>
  );
}
