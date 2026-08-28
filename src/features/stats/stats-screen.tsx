import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, EmptyState, Surface } from '@/components/primitives';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { loadLearningStats, type LearningStats } from '@/stats/metrics';
import { colors, spacing, typography } from '@/theme/tokens';

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Surface style={{ flexGrow: 1, flexBasis: 150, padding: spacing.md, gap: spacing.xs }}>
      <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '700' }}>{label}</Text>
      <Text selectable style={{ color: colors.ink, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text>
      {detail ? <Text selectable style={{ color: colors.inkMuted, lineHeight: 20 }}>{detail}</Text> : null}
    </Surface>
  );
}

export function StatsScreen() {
  const sqlite = useSQLiteContext();
  const { loading: pairLoading, pair } = useActiveLanguagePair();
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!pair) return () => { cancelled = true; };
    void loadLearningStats(sqlite, pair.id)
      .then((next) => {
        if (cancelled) return;
        setStats(next);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load learning stats.');
      });
    return () => { cancelled = true; };
  }, [pair, sqlite]);

  if (pairLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="Loading learning stats" /></View>;
  if (!pair) return <EmptyState title="Choose a language pair first" body="Stats stay scoped to one learning language so progress from different banks is never mixed." action={<Link href="/settings" asChild><ActionButton label="Choose languages" /></Link>} />;
  if (error) return <EmptyState title="Stats are unavailable" body={error} action={<Link href="/" asChild><ActionButton label="Back to study" /></Link>} />;
  if (!stats) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="Calculating learning stats" /></View>;

  const retention = stats.retention30Days === null ? '—' : `${Math.round(stats.retention30Days * 100)}%`;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>Learning pulse</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25 }}>{pair.targetLanguageName} · explainable metrics from your review history</Text>
      </View>

      <Surface style={{ padding: spacing.lg, gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>What to do next</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25 }}>{stats.insight}</Text>
        <Link href="/" asChild><ActionButton label={stats.dueNow > 0 ? `Review ${stats.dueNow} due now` : 'Open study'} /></Link>
      </Surface>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Metric label="Due now" value={String(stats.dueNow)} detail="New + scheduled reviews" />
        <Metric label="30-day recall" value={retention} detail={`${stats.remembered30Days} knew · ${stats.forgotten30Days} forgot`} />
        <Metric label="Reviewed today" value={String(stats.reviewedToday)} detail={`${stats.reviewed30Days} in the last 30 days`} />
        <Metric label="7-day momentum" value={`${stats.activeDays7}/7`} detail="Study days, not a punitive streak" />
      </View>

      <Surface style={{ padding: spacing.lg, gap: spacing.md }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Vocabulary state</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          <View><Text selectable style={{ color: colors.inkMuted }}>Total</Text><Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: '800' }}>{stats.totalCards}</Text></View>
          <View><Text selectable style={{ color: colors.inkMuted }}>New</Text><Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: '800' }}>{stats.newCards}</Text></View>
          <View><Text selectable style={{ color: colors.inkMuted }}>Learning</Text><Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: '800' }}>{stats.learningCards}</Text></View>
          <View><Text selectable style={{ color: colors.inkMuted }}>Strong</Text><Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: '800' }}>{stats.strongCards}</Text></View>
        </View>
        <Text selectable style={{ color: colors.inkMuted, lineHeight: 22 }}>“Strong” means the scheduler has moved the card into review/mastered state. It does not mean the word is learned forever.</Text>
      </Surface>
    </ScrollView>
  );
}
