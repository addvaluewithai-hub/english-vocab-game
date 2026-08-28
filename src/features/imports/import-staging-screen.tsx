import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { ImportStagingService, type ImportBatch, type StagedCandidate } from '@/imports/staging';
import { colors, spacing, typography } from '@/theme/tokens';

const DEMO_CANDIDATES = [
  { term: 'nevertheless', translation: 'مع ذلك', definition: 'despite what has just been said', contextSentence: 'The task was difficult; nevertheless, we finished it.', usefulnessScore: 0.86, confidenceScore: 0.95 },
  { term: 'charge', translation: 'يشحن', definition: 'to put electricity into a battery', contextSentence: 'Remember to charge your phone.', usefulnessScore: 0.78, confidenceScore: 0.91 },
];

export function ImportStagingScreen() {
  const router = useRouter();
  const sqlite = useSQLiteContext();
  const { pair } = useActiveLanguagePair();
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [candidates, setCandidates] = useState<StagedCandidate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const service = new ImportStagingService(sqlite);

  async function load() {
    if (!pair) return;
    const latest = await service.latestPendingBatch(pair.id);
    setBatch(latest);
    setCandidates(latest ? await service.listCandidates(latest.id) : []);
  }
  useEffect(() => { void load(); }, [pair, sqlite]);

  if (!pair) return <EmptyState title="No active language pair" body="Choose your languages before reviewing imports." />;
  if (!batch) {
    return <EmptyState title="No import waiting for review" body="Future text, PDF, YouTube, URL and photo importers all feed this same approval queue." action={__DEV__ ? <ActionButton label="Create demo import" onPress={() => void service.createBatch(pair.id, 'TEXT', 'Demo pasted text', DEMO_CANDIDATES).then(load)} /> : undefined} />;
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs }}><Text selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>Review before adding</Text><Text selectable style={{ color: colors.inkMuted }}>{batch.sourceTitle ?? batch.sourceType} · AI/import suggestions are editable proposals, not facts.</Text></View>
      {message ? <Surface style={{ padding: spacing.md }}><Text style={{ color: colors.success }}>{message}</Text></Surface> : null}
      {candidates.map((candidate) => (
        <Pressable key={candidate.id} onPress={() => void service.setSelected(candidate.id, !candidate.selected).then(load)} accessibilityRole="checkbox" accessibilityState={{ checked: candidate.selected }}>
          <Surface style={{ padding: spacing.md, gap: spacing.sm, opacity: candidate.selected ? 1 : 0.55 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}><Text selectable style={{ color: colors.ink, fontSize: 21, fontWeight: '800', flex: 1 }}>{candidate.term}</Text><Chip>{candidate.selected ? 'SELECTED' : 'SKIP'}</Chip></View>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body }}>{candidate.translation}</Text>
            {candidate.contextSentence ? <Text selectable style={{ color: colors.inkMuted, lineHeight: 22 }}>“{candidate.contextSentence}”</Text> : null}
            {candidate.duplicateKind !== 'NONE' ? <Text selectable style={{ color: colors.danger, fontWeight: '700' }}>{candidate.duplicateKind === 'EXACT' ? 'Exact duplicate — skipped by default' : 'Same term exists with another sense'}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{candidate.usefulnessScore !== undefined ? <Chip>Useful {Math.round(candidate.usefulnessScore * 100)}%</Chip> : null}{candidate.confidenceScore !== undefined ? <Chip>Confidence {Math.round(candidate.confidenceScore * 100)}%</Chip> : null}</View>
          </Surface>
        </Pressable>
      ))}
      <ActionButton label={`Add ${candidates.filter((item) => item.selected && item.duplicateKind !== 'EXACT').length} selected`} onPress={() => void service.approveSelected(batch).then((count) => { setMessage(`${count} items added to your bank.`); return load(); }).then(() => router.replace('/bank'))} />
    </ScrollView>
  );
}
