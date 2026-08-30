import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { ImportStagingService, type ImportBatch, type StagedCandidate } from '@/imports/staging';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const DEMO_CANDIDATES = [
  { term: 'nevertheless', translation: 'مع ذلك', definition: 'despite what has just been said', contextSentence: 'The task was difficult; nevertheless, we finished it.', exampleTranslation: 'كانت المهمة صعبة؛ ومع ذلك أنهيناها.', usefulnessScore: 0.86, confidenceScore: 0.95 },
  { term: 'charge', translation: 'يشحن', definition: 'to put electricity into a battery', contextSentence: 'Remember to charge your phone.', exampleTranslation: 'تذكر أن تشحن هاتفك.', usefulnessScore: 0.78, confidenceScore: 0.91 },
];

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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
        <Chip>{candidate.selected ? 'SELECTED' : 'SKIPPED'}</Chip>
        {candidate.duplicateKind !== 'NONE' ? <Chip>{candidate.duplicateKind === 'EXACT' ? 'EXACT DUPLICATE' : 'NEW SENSE?'}</Chip> : null}
      </View>
      <TextInput accessibilityLabel="Candidate term" value={term} onChangeText={setTerm} onBlur={() => void saveEdits()} style={{ minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, fontSize: 20, fontWeight: '800' }} />
      <TextInput accessibilityLabel="Candidate meaning" value={translation} onChangeText={setTranslation} onBlur={() => void saveEdits()} style={{ minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, fontSize: typography.body }} />
      <TextInput accessibilityLabel="Candidate definition" value={definition} onChangeText={setDefinition} onBlur={() => void saveEdits()} placeholder="English definition" placeholderTextColor={colors.inkMuted} multiline style={{ minHeight: 64, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.inkMuted }} />
      <TextInput accessibilityLabel="Candidate example" value={context} onChangeText={setContext} onBlur={() => void saveEdits()} placeholder="English example sentence" placeholderTextColor={colors.inkMuted} multiline style={{ minHeight: 72, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.inkMuted }} />
      <TextInput accessibilityLabel="Candidate example translation" value={exampleTranslation} onChangeText={setExampleTranslation} onBlur={() => void saveEdits()} placeholder="Arabic translation of the example" placeholderTextColor={colors.inkMuted} multiline style={{ minHeight: 64, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.inkMuted }} />
      {candidate.duplicateKind !== 'NONE' ? <Text selectable style={{ color: colors.danger, fontWeight: '700' }}>{candidate.duplicateKind === 'EXACT' ? 'Already in the bank; skipped by default.' : 'This term exists, but this may be a different sense.'}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {candidate.usefulnessScore !== undefined ? <Chip>Useful {Math.round(candidate.usefulnessScore * 100)}%</Chip> : null}
        {candidate.confidenceScore !== undefined ? <Chip>Confidence {Math.round(candidate.confidenceScore * 100)}%</Chip> : null}
      </View>
      <ActionButton label={candidate.selected ? 'Skip this candidate' : 'Include this candidate'} onPress={() => void service.setSelected(candidate.id, !candidate.selected).then(reload)} />
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

  if (!pair) return <EmptyState title="Preparing English" body="English → Arabic is created automatically on first launch." />;
  const service = new ImportStagingService(sqlite);
  if (!batch) {
    return <EmptyState title="No import waiting for review" body="Text, images, PDF, YouTube and public URLs all feed this same editable review queue." action={<ActionButton label="Start Gemini Smart Import" onPress={() => router.replace('/smart-import')} />} />;
  }

  const selectedCount = candidates.filter((item) => item.selected && item.duplicateKind !== 'EXACT').length;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs }}><Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>Final review</Text><Text selectable style={{ color: colors.inkMuted }}>{batch.sourceTitle ?? batch.sourceType} · Gemini suggestions stay editable until you add them to your Bank.</Text></View>
      {message ? <Surface style={{ padding: spacing.md }}><Text style={{ color: colors.success }}>{message}</Text></Surface> : null}
      {candidates.map((candidate) => <CandidateEditor key={candidate.id} candidate={candidate} service={service} reload={reload} />)}
      <ActionButton label={`Add ${selectedCount} selected to Bank`} disabled={selectedCount === 0} onPress={() => void service.approveSelected(batch).then((count) => { setMessage(`${count} items added to your bank.`); return reload(); }).then(() => router.replace('/bank'))} />
    </ScrollView>
  );
}
