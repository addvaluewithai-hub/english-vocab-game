import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { ImportStagingService, type ImportBatch, type StagedCandidate } from '@/imports/staging';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const DEMO_CANDIDATES = [
  { term: 'nevertheless', translation: 'مع ذلك', definition: 'despite what has just been said', contextSentence: 'The task was difficult; nevertheless, we finished it.', usefulnessScore: 0.86, confidenceScore: 0.95, cefrLevel: 'B2' as const },
  { term: 'charge', translation: 'يشحن', definition: 'to put electricity into a battery', contextSentence: 'Remember to charge your phone.', usefulnessScore: 0.78, confidenceScore: 0.91, cefrLevel: 'A2' as const },
];

function CandidateEditor({ candidate, service, reload }: { candidate: StagedCandidate; service: ImportStagingService; reload: () => Promise<void> }) {
  const [term, setTerm] = useState(candidate.term);
  const [translation, setTranslation] = useState(candidate.translation);
  const [definition, setDefinition] = useState(candidate.definition ?? '');
  const [context, setContext] = useState(candidate.contextSentence ?? '');

  async function saveEdits() {
    await service.updateCandidate(candidate.id, { term, translation, definition, contextSentence: context });
    await reload();
  }

  return (
    <Surface style={{ padding: spacing.md, gap: spacing.sm, opacity: candidate.selected ? 1 : 0.66 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          <Chip>{candidate.recommended ? 'RECOMMENDED' : 'OPTIONAL'}</Chip>
          {candidate.cefrLevel ? <Chip>{candidate.cefrLevel}</Chip> : null}
          <Chip>Rank {Math.round(candidate.rankingScore * 100)}</Chip>
        </View>
        {candidate.duplicateKind !== 'NONE' ? <Chip>{candidate.duplicateKind === 'EXACT' ? 'IN BANK' : 'NEW SENSE?'}</Chip> : null}
      </View>
      <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>{candidate.rankingReason}</Text>
      <TextInput accessibilityLabel="Candidate term" value={term} onChangeText={setTerm} onBlur={() => void saveEdits()} style={{ minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, fontSize: 20, fontWeight: '800' }} />
      <TextInput accessibilityLabel="Candidate meaning" value={translation} onChangeText={setTranslation} onBlur={() => void saveEdits()} style={{ minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, fontSize: typography.body }} />
      <TextInput accessibilityLabel="Candidate definition" value={definition} onChangeText={setDefinition} onBlur={() => void saveEdits()} placeholder="Optional definition" placeholderTextColor={colors.inkMuted} multiline style={{ minHeight: 64, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.inkMuted }} />
      <TextInput accessibilityLabel="Candidate context" value={context} onChangeText={setContext} onBlur={() => void saveEdits()} placeholder="Optional context" placeholderTextColor={colors.inkMuted} multiline style={{ minHeight: 72, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.inkMuted }} />
      {candidate.duplicateKind !== 'NONE' ? <Text selectable style={{ color: colors.danger, fontWeight: '700' }}>{candidate.duplicateKind === 'EXACT' ? 'Already in your bank. Keeping it selected saves this new source occurrence without creating another card.' : 'This spelling exists, but the context may represent a different sense.'}</Text> : null}
      {candidate.knownLifecycle === 'MASTERED' ? <Text selectable style={{ color: colors.inkMuted }}>This sense is already strong, so it is deprioritized rather than deleted from the source.</Text> : null}
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
  const [showAdditional, setShowAdditional] = useState(false);

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

  if (!pair) return <EmptyState title="No active language pair" body="Choose your languages before reviewing imports." />;
  const service = new ImportStagingService(sqlite);
  if (!batch) {
    return <EmptyState title="No import waiting for review" body="Text, PDF and YouTube imports feed this same approval queue. URL/photo adapters can join later without changing the bank model." action={__DEV__ ? <ActionButton label="Create demo import" onPress={() => void service.createBatch(pair.id, 'TEXT', 'Demo pasted text', DEMO_CANDIDATES).then(reload)} /> : undefined} />;
  }

  const selectedCount = candidates.filter((item) => item.selected).length;
  const primaryCandidates = candidates.filter((item) => item.recommended || item.duplicateKind === 'EXACT');
  const additionalCandidates = candidates.filter((item) => !item.recommended && item.duplicateKind !== 'EXACT');
  const visibleCandidates = showAdditional ? candidates : primaryCandidates;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs }}><Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>Review before adding</Text><Text selectable style={{ color: colors.inkMuted }}>{batch.sourceTitle ?? batch.sourceType} · Ranked suggestions are editable proposals, not authoritative answers.</Text></View>
      {message ? <Surface style={{ padding: spacing.md }}><Text style={{ color: colors.success }}>{message}</Text></Surface> : null}
      {visibleCandidates.map((candidate) => <CandidateEditor key={candidate.id} candidate={candidate} service={service} reload={reload} />)}
      {additionalCandidates.length > 0 ? <ActionButton label={showAdditional ? 'Hide additional candidates' : `Show ${additionalCandidates.length} additional candidate${additionalCandidates.length === 1 ? '' : 's'}`} onPress={() => setShowAdditional((value) => !value)} /> : null}
      <ActionButton label={`Save ${selectedCount} selected`} disabled={selectedCount === 0} onPress={() => void service.approveSelected(batch).then((count) => { setMessage(`${count} selected items handled. Existing senses kept their new source occurrence without duplication.`); return reload(); }).then(() => router.replace('/bank'))} />
    </ScrollView>
  );
}
