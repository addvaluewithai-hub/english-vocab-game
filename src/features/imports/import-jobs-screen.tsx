import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { ImportJobRepository, type ImportJob } from '@/imports/jobs';
import { colors, spacing, typography } from '@/theme/tokens';

function statusCopy(job: ImportJob): string {
  if (job.status === 'QUEUED') return 'Waiting for the server-side importer.';
  if (job.status === 'PROCESSING') return 'Extraction and enrichment are running server-side. You can leave this screen.';
  if (job.status === 'NEEDS_REVIEW') return `${job.candidates?.length ?? 0} candidates are ready for your approval.`;
  if (job.status === 'COMPLETED') return 'Reviewed candidates were handled through staging.';
  if (job.status === 'CANCELLED') return 'Cancelled safely. The source fingerprint is retained for deliberate retry.';
  return job.errorMessage ?? 'The import failed before candidates were added to your bank.';
}

export function ImportJobsScreen() {
  const sqlite = useSQLiteContext();
  const { loading: pairLoading, pair } = useActiveLanguagePair();
  const [jobs, setJobs] = useState<ImportJob[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function reload(languagePairId: string): Promise<void> {
    setJobs(await new ImportJobRepository(sqlite).list(languagePairId));
  }

  useEffect(() => {
    let cancelled = false;
    if (!pair) return () => { cancelled = true; };
    void new ImportJobRepository(sqlite).list(pair.id).then((rows) => {
      if (!cancelled) setJobs(rows);
    });
    return () => { cancelled = true; };
  }, [pair, sqlite]);

  async function retry(job: ImportJob): Promise<void> {
    const updated = await new ImportJobRepository(sqlite).prepareRetry(job.id);
    setMessage(updated.status === 'QUEUED' ? 'Retry queued. The source-specific importer can safely resubmit it with the same idempotency key.' : 'This job does not need a retry.');
    if (pair) await reload(pair.id);
  }

  async function cancel(job: ImportJob): Promise<void> {
    await new ImportJobRepository(sqlite).cancel(job.id);
    setMessage('Import cancelled locally. No vocabulary was auto-added.');
    if (pair) await reload(pair.id);
  }

  if (pairLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="Loading import jobs" /></View>;
  if (!pair) return <EmptyState title="Choose languages first" body="Imports belong to one language pair so candidates cannot leak between banks." action={<Link href="/settings" asChild><ActionButton label="Open settings" /></Link>} />;
  if (jobs === null) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="Loading import jobs" /></View>;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>Smart imports</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25 }}>Turn material you already consume into a curated review queue. Nothing reaches your vocabulary bank before your approval.</Text>
      </View>

      <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: '800' }}>Start an import</Text>
        <Text selectable style={{ color: colors.inkMuted, lineHeight: 22 }}>Paste prose for a curated extraction, or paste a word/phrase list with explicit meanings for a fully local import.</Text>
        <Link href="/imports/text" asChild><ActionButton label="Paste text or vocabulary list" /></Link>
      </Surface>

      {message ? <Surface style={{ padding: spacing.md }}><Text accessibilityLiveRegion="polite" selectable style={{ color: colors.inkMuted }}>{message}</Text></Surface> : null}
      {jobs.length === 0 ? <EmptyState title="No import history yet" body="Your text imports will appear here. PDF, YouTube, URL, and photo adapters use the same job pipeline as they are enabled." /> : jobs.map((job) => (
        <Surface key={job.id} style={{ padding: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: '800' }}>{job.sourceLabel || `${job.sourceType} import`}</Text>
              <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>{new Date(job.updatedAt).toLocaleString()}</Text>
            </View>
            <Chip>{job.status.replace('_', ' ')}</Chip>
          </View>
          <Text selectable style={{ color: colors.inkMuted, lineHeight: 22 }}>{statusCopy(job)}</Text>
          {job.status === 'NEEDS_REVIEW' ? <Link href="/import-staging" asChild><ActionButton label="Review candidates" /></Link> : null}
          {job.status === 'FAILED' || job.status === 'CANCELLED' ? <ActionButton label="Queue safe retry" onPress={() => void retry(job)} /> : null}
          {job.status === 'QUEUED' || job.status === 'PROCESSING' ? <ActionButton label="Cancel import" tone="danger" onPress={() => void cancel(job)} /> : null}
        </Surface>
      ))}
    </ScrollView>
  );
}
