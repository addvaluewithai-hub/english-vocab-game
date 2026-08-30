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

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

function Field({ label, value, onChangeText, placeholder, multiline = false, rtl = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean; rtl?: boolean }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.ink, fontSize: typography.label, fontWeight: '800', ...(rtl ? rtlText : {}) }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{ minHeight: multiline ? 88 : 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.ink, fontSize: typography.body, ...(rtl ? rtlText : {}) }}
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
      setMessage('Gemini ظبط لك المعنى والمثال. عدّل أي حاجة قبل ما تحفظ.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gemini معرفش يكمل الكلمة دلوقتي. جرّب كمان شوية.');
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
      setError(caught instanceof Error ? caught.message : 'مقدرناش نضيف الكلمة. جرّب تاني.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><Text style={{ color: colors.inkMuted, ...rtlText }}>بنجهزلك الدنيا…</Text></View>;
  if (!pair) return <EmptyState title="بنجهز الإنجليزي" body="English → Arabic بيتعمل تلقائي أول ما تفتح التطبيق." />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ width: '100%', maxWidth: 680, alignSelf: 'center', padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontWeight: '800', ...rtlText }}>إضافة سريعة</Text>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '900', ...rtlText }}>ضيف كلمة أو عبارة</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 24, ...rtlText }}>اكتبها بس، وGemini يقدر يجيب لك المعنى بالعربي ومثال طبيعي تستخدمها فيه.</Text>
      </View>

      {error ? <Surface style={{ padding: spacing.md, backgroundColor: colors.dangerSurface }}><Text selectable style={{ color: colors.danger, ...rtlText }}>{error}</Text></Surface> : null}

      <Field label="الكلمة أو العبارة بالإنجليزي" value={term} onChangeText={(value) => { setTerm(value); setMessage(null); }} placeholder="e.g. look forward to" />

      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row-reverse', gap: spacing.sm }}>
        {(['WORD', 'PHRASE'] as const).map((value) => {
          const selected = kind === value;
          return (
            <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setKind(value)} style={{ paddingHorizontal: 15, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: selected ? colors.ink : colors.surfaceMuted }}>
              <Text style={{ color: selected ? colors.surface : colors.inkMuted, fontWeight: '800', ...rtlText }}>{value === 'WORD' ? 'كلمة' : 'عبارة'}</Text>
            </Pressable>
          );
        })}
      </View>

      <Surface style={{ padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surfaceMuted }}>
        <View style={{ flexDirection: 'row-reverse', gap: spacing.sm, alignItems: 'center' }}>
          <Text aria-hidden style={{ fontSize: 28 }}>✨</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: '900', ...rtlText }}>خلي Gemini يكملها</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 18, ...rtlText }}>المعنى، التعريف، ومثال طبيعي على الكلمة.</Text>
          </View>
        </View>
        <ActionButton label={thinking ? 'بيفكر…' : 'كمّل بـ Gemini'} disabled={thinking || !term.trim()} onPress={() => void fillWithGemini()} />
        {message ? <Text selectable style={{ color: colors.success, fontSize: typography.small, fontWeight: '700', ...rtlText }}>{message}</Text> : null}
      </Surface>

      <Field label="المعنى بالعربي" value={translation} onChangeText={setTranslation} placeholder="المعنى" rtl />
      <Field label="مثال" value={context} onChangeText={setContext} placeholder="A natural sentence using the word" multiline />

      <Pressable onPress={() => setShowMore((value) => !value)}>
        <Text style={{ color: colors.accent, fontSize: typography.label, fontWeight: '800', ...rtlText }}>{showMore ? 'اخفي التفاصيل الزيادة' : 'وريني تفاصيل أكتر'}</Text>
      </Pressable>

      {showMore ? (
        <View style={{ gap: spacing.md }}>
          <Field label="التعريف بالإنجليزي" value={definition} onChangeText={setDefinition} multiline />
          <Field label="نوع الكلمة" value={partOfSpeech} onChangeText={setPartOfSpeech} placeholder="noun, verb, adjective…" />
          <Field label="ترجمة المثال" value={exampleTranslation} onChangeText={setExampleTranslation} multiline rtl />
        </View>
      ) : null}

      <ActionButton label={saving ? 'بنضيفها…' : 'ضيفها لكلماتي'} disabled={saving || !term.trim() || !translation.trim()} onPress={() => void save()} />
    </ScrollView>
  );
}
