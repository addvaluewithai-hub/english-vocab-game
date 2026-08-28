import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getNeonJwtToken } from '@/auth/neon-auth';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { HttpImportJobTransport } from '@/imports/http-transport';
import { ImportJobRepository, ImportJobService, type ImportJob } from '@/imports/jobs';
import { canRetryImport, IMPORT_POLICY } from '@/imports/policy';
import { colors, spacing, typography } from '@/theme/tokens';

function statusCopy(job: ImportJob): string {
  if (job.status === 'QUEUED') return 'Ready for source resubmission. Raw source content is not retained just to make retries automatic.';
  if (job.status === 'PROCESSING') return 'Extraction and enrichment are running server-side. You can leave this screen and refresh later.';
  if (job.status === 'NEEDS_REVIEW') return `${job.candidates?.length ?? 0} candidates are ready for your approval.`;
  if (job.status === 'COMPLETED') return 'Reviewed candidates were handled through staging.';
  if (job.status === 'CANCELLED') return 'Cancelled on this device and server. You can deliberately reopen the source while retries remain.';
  return job.errorMessage ?? 'The import failed before candidates were added to your bank.';
}

function sourceRoute(job: ImportJob): '/imports/text' | '/imports/pdf' | '/imports/youtube' | '/imports' {
  if (job.sourceType === 'TEXT') return '/imports/text';
  if (job.sourceType === 'PDF') return '/imports/pdf';
  if (job.sourceType === 'YOUTUBE') return '/imports/youtube';
  return '/imports';
}

export function ImportJobsScreen() {
  const router = useRouter();
  const sqlite = useSQLiteContext();
  const { loading: pairLoading, pair, ownerKey } = useActiveLanguagePair();
  const [jobs, setJobs] = useState<ImportJob[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  async function reload(languagePairId: string): Promise<ImportJob[]> {
    const rows = await new ImportJobRepository(sqlite).list(languagePairId);
    setJobs(rows);
    return rows;
  }

  async function refreshProcessing(languagePairId: string): Promise<void> {
    if (ownerKey === 'guest') {
      await reload(languagePairId);
      return;
    }
    setRefreshing(true);
    try {
      const rows = await new ImportJobRepository(sqlite).list(languagePairId);
      const service = new ImportJobService(sqlite, new HttpImportJobTransport(getNeonJwtToken));
      for (const job of rows) {
        if (job.status !== 'PROCESSING' || !job.serverJobId) continue;
        try {
          await service.refresh(job.id);
        } catch {
          // Keep durable local state; a later explicit refresh can retry the network request.
        }
      }
      await reload(languagePairId);
    } finally {
      setRefreshing(false);
    }
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
    if (!canRetryImport(job.retryCount)) {
      setMessage(`This import reached the ${IMPORT_POLICY.retry.maxAttempts}-retry limit. Start again only if the source changed.`);
      return;
    }
    setBusyJobId(job.id);
    try {
      const service = new ImportJobService(sqlite, new HttpImportJobTransport(getNeonJwtToken));
      const updated = await service.retry(job.id);
      setMessage(`Retry ${updated.retryCount}/${IMPORT_POLICY.retry.maxAttempts} opened. Re-submit the source; its raw content was not retained.`);
      router.push(sourceRoute(job));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not reopen this import.');
    } finally {
      setBusyJobId(null);
      if (pair) await reload(pair.id);
    }
  }

  async function cancel(job: ImportJob): Promise<void> {
    setBusyJobId(job.id);
    try {
      await new ImportJobService(sqlite, new HttpImportJobTransport(getNeonJwtToken)).cancel(job.id);
      setMessage('Import cancelled. No vocabulary was auto-added.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not confirm cancellation with the server.');
    } finally {
      setBusyJobId(null);
      if (pair) await reload(pair.id);
    }
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
        <Text selectable style={{ color: colors.inkMuted, lineHeight: 22 }}>Paste text locally, analyze a public YouTube video, or send a PDF through the durable import pipeline.</Text>
        <Link href="/imports/text" asChild><ActionButton label="Paste text or vocabulary list" /></Link>
        <Link href="/imports/youtube" asChild><ActionButton label="Import YouTube video" /></Link>
        <Link href="/imports/pdf" asChild><ActionButton label="Import PDF" /></Link>
      </Surface>

      {jobs.some((job) => job.status === 'PROCESSING') ? (
        <ActionButton label={refreshing ? 'Refreshing…' : 'Refresh processing imports'} disabled={refreshing} onPress={() => void refreshProcessing(pair.id)} />
      ) : null}

      {message ? <Surface style={{ padding: spacing.md }}><Text accessibilityLiveRegion="polite" selectable style={{ color: colors.inkMuted }}>{message}</Text></Surface> : null}
      {jobs.length === 0 ? <EmptyState title="No import history yet" body="Text, YouTube, and PDF imports will appear here. Optional URL and photo sources can be added later without changing the review pipeline." /> : jobs.map((job) => {
        const retryAvailable = canRetryImport(job.retryCount);
        const busy = busyJobId === job.id;
        return (
          <Surface key={job.id} style={{ padding: spacing.md, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: '800' }}>{job.sourceLabel || `${job.sourceType} import`}</Text>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>{new Date(job.updatedAt).toLocaleString()}</Text>
              </View>
              <Chip>{job.status.replace('_', ' ')}</Chip>
            </View>
            <Text selectable style={{ color: colors.inkMuted, lineHeight: 22 }}>{statusCopy(job)}</Text>
            {job.retryCount > 0 ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>Retries used: {job.retryCount}/{IMPORT_POLICY.retry.maxAttempts}</Text> : null}
            {job.status === 'NEEDS_REVIEW' ? <Link href="/import-staging" asChild><ActionButton label="Review candidates" /></Link> : null}
            {job.status === 'FAILED' || job.status === 'CANCELLED' ? (
              retryAvailable
                ? <ActionButton label={busy ? 'Reopening…' : 'Reopen source to retry'} disabled={busy} onPress={() => void retry(job)} />
                : <Text selectable style={{ color: colors.danger, fontWeight: '700' }}>Retry limit reached. This job will not generate more AI work.</Text>
            ) : null}
            {job.status === 'QUEUED' && job.retryCount > 0 ? <ActionButton label="Open source" onPress={() => router.push(sourceRoute(job))} /> : null}
            {job.status === 'QUEUED' || job.status === 'PROCESSING' ? <ActionButton label={busy ? 'Cancelling…' : 'Cancel import'} tone="danger" disabled={busy} onPress={() => void cancel(job)} /> : null}
          </Surface>
        );
      })}
    </ScrollView>
  );
}
