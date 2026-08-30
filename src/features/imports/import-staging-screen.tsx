import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { ImportStagingService, type ImportBatch, type StagedCandidate } from '@/imports/staging';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

function CandidateEditor({ candidate, service, reload }: { candidate: StagedCandidate; service: ImportStagingService; reload: () => Promise<void> }) {
  const [term, setTerm] = useState(candidate.term);
  const [translation, setTranslation] = useState(candidate.translation);
  const [definition, setDefinition] = useState(candidate.definition ?? '');
  const [context, setContext] = useState(candidate.contextSentence ?? '');
  const [exampleTranslation, setExampleTranslation] = useState(candidate.exampleTranslation ?? '');

  async function saveEdits() {
    await service.updateCandidate(candidate.id, { term, translation, definition, contextSentence: context, exampleTranslation });
    await reload();
  }

  return (
    <Surface style={{ padding: spacing.md, gap: spacing.sm, opacity: candidate.selected ? 1 : 0.58 }}>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
        <Chip>{candidate.selected ? 'مختارة' : 'متشالة'}</Chip>
        {candidate.duplicateKind !== 'NONE' ? <Chip>{candidate.duplicateKind === 'EXACT' ? 'موجودة عندك' : 'معنى جديد؟'}</Chip> : null}
      </View>
      <TextInput accessibilityLabel="الكلمة" value={term} onChangeText={setTerm} onBlur={() => void saveEdits()} style={{ minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, fontSize: 20, fontWeight: '800' }} />
      <TextInput accessibilityLabel="المعنى" value={translation} onChangeText={setTranslation} onBlur={() => void saveEdits()} style={{ minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, fontSize: typography.body, ...rtlText }} />
      <TextInput accessibilityLabel="التعريف" value={definition} onChangeText={setDefinition} onBlur={() => void saveEdits()} placeholder="تعريف قصير بالإنجليزي" placeholderTextColor={colors.inkMuted} multiline style={{ minHeight: 64, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.inkMuted }} />
      <TextInput accessibilityLabel="المثال" value={context} onChangeText={setContext} onBlur={() => void saveEdits()} placeholder="مثال طبيعي بالإنجليزي" placeholderTextColor={colors.inkMuted} multiline style={{ minHeight: 72, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.inkMuted }} />
      <TextInput accessibilityLabel="ترجمة المثال" value={exampleTranslation} onChangeText={setExampleTranslation} onBlur={() => void saveEdits()} placeholder="ترجمة المثال بالعربي" placeholderTextColor={colors.inkMuted} multiline style={{ minHeight: 64, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.inkMuted, ...rtlText }} />
      {candidate.duplicateKind !== 'NONE' ? <Text selectable style={{ color: colors.danger, fontWeight: '700', ...rtlText }}>{candidate.duplicateKind === 'EXACT' ? 'الكلمة موجودة عندك بالفعل، فشيلناها من الاختيار تلقائي.' : 'الكلمة موجودة، بس ممكن يكون ده معنى مختلف.'}</Text> : null}
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm }}>
        {candidate.usefulnessScore !== undefined ? <Chip>مفيدة {Math.round(candidate.usefulnessScore * 100)}%</Chip> : null}
        {candidate.confidenceScore !== undefined ? <Chip>ثقة {Math.round(candidate.confidenceScore * 100)}%</Chip> : null}
      </View>
      <ActionButton label={candidate.selected ? 'شيل الكلمة دي' : 'رجّع الكلمة دي'} onPress={() => void service.setSelected(candidate.id, !candidate.selected).then(reload)} />
    </Surface>
  );
}

export function ImportStagingScreen() {
  const router = useRouter();
  const sqlite = useSQLiteContext();
  const { pair } = useActiveLanguagePair();
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [candidates, setCandidates] = useState<StagedCandidate[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    if (!pair) return;
    const service = new ImportStagingService(sqlite);
    const latest = await service.latestPendingBatch(pair.id);
    setBatch(latest);
    setCandidates(latest ? await service.listCandidates(latest.id) : []);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!pair) return;
      const service = new ImportStagingService(sqlite);
      const latest = await service.latestPendingBatch(pair.id);
      const nextCandidates = latest ? await service.listCandidates(latest.id) : [];
      if (!cancelled) { setBatch(latest); setCandidates(nextCandidates); }
    }
    void load();
    return () => { cancelled = true; };
  }, [pair, sqlite]);

  if (!pair) return <EmptyState title="بنجهز الإنجليزي" body="بنظبط الإنجليزي ومعانيه بالعربي تلقائي أول ما تفتح التطبيق." />;
  const service = new ImportStagingService(sqlite);
  if (!batch) {
    return <EmptyState title="مفيش كلمات مستنية مراجعة" body="النص، الصور، PDF، يوتيوب واللينكات كلهم بيروحوا لنفس شاشة المراجعة دي." action={<ActionButton label="ابدأ إضافة ذكية" onPress={() => router.replace('/smart-import')} />} />;
  }

  const selectedCount = candidates.filter((item) => item.selected && item.duplicateKind !== 'EXACT').length;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '900', ...rtlText }}>راجع قبل ما تضيف</Text>
        <Text selectable style={{ color: colors.inkMuted, ...rtlText }}>{batch.sourceTitle ?? batch.sourceType} · اقتراحات Gemini قابلة للتعديل لحد آخر لحظة.</Text>
      </View>
      {message ? <Surface style={{ padding: spacing.md }}><Text style={{ color: colors.success, ...rtlText }}>{message}</Text></Surface> : null}
      {candidates.map((candidate) => <CandidateEditor key={candidate.id} candidate={candidate} service={service} reload={reload} />)}
      <ActionButton label={`ضيف ${selectedCount} كلمة لكلماتي`} disabled={selectedCount === 0} onPress={() => void service.approveSelected(batch).then((count) => { setMessage(`تمام، اتضاف ${count} عنصر لكلماتك.`); return reload(); }).then(() => router.replace('/bank'))} />
    </ScrollView>
  );
}
