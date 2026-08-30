import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, EmptyState, Surface } from '@/components/primitives';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { loadLearningStats, type LearningStats } from '@/stats/metrics';
import { colors, spacing, typography } from '@/theme/tokens';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Surface style={{ flexGrow: 1, flexBasis: 150, padding: spacing.md, gap: spacing.xs, alignItems: 'flex-end' }}>
      <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '700', ...rtlText }}>{label}</Text>
      <Text selectable style={{ color: colors.ink, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text>
      {detail ? <Text selectable style={{ color: colors.inkMuted, lineHeight: 20, ...rtlText }}>{detail}</Text> : null}
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
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'مقدرناش نحمّل تقدمك.');
      });
    return () => { cancelled = true; };
  }, [pair, sqlite]);

  if (pairLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="بنحمّل تقدمك" /></View>;
  if (!pair) return <EmptyState title="بنجهز الإنجليزي" body="English → Arabic بيتعمل تلقائي أول ما تفتح التطبيق." />;
  if (error) return <EmptyState title="تقدمك مش متاح دلوقتي" body={error} action={<Link href="/" asChild><ActionButton label="ارجع للرئيسية" /></Link>} />;
  if (!stats) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="بنحسب تقدمك" /></View>;

  const retention = stats.retention30Days === null ? '—' : `${Math.round(stats.retention30Days * 100)}%`;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800', ...rtlText }}>تقدمك</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25, ...rtlText }}>أرقام واضحة من مراجعاتك الفعلية، من غير تعقيد.</Text>
      </View>

      <Surface style={{ padding: spacing.lg, gap: spacing.sm, alignItems: 'flex-end' }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '800', ...rtlText }}>تعمل إيه دلوقتي؟</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25, ...rtlText }}>{stats.insight}</Text>
        <View style={{ width: '100%' }}><Link href="/study" asChild><ActionButton label={stats.dueNow > 0 ? `راجع ${stats.dueNow} كلمة دلوقتي` : 'افتح المذاكرة'} /></Link></View>
      </Surface>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Metric label="محتاجين مراجعة" value={String(stats.dueNow)} detail="جديدة + مراجعات مستحقة" />
        <Metric label="تذكر آخر 30 يوم" value={retention} detail={`${stats.remembered30Days} عارفهم · ${stats.forgotten30Days} نسيتهم`} />
        <Metric label="راجعت النهارده" value={String(stats.reviewedToday)} detail={`${stats.reviewed30Days} آخر 30 يوم`} />
        <Metric label="نشاط آخر 7 أيام" value={`${stats.activeDays7}/7`} detail="أيام ذاكرت فيها، مش streak عقابي" />
      </View>

      <Surface style={{ padding: spacing.lg, gap: spacing.md }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '800', ...rtlText }}>حالة كلماتك</Text>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.lg }}>
          <View style={{ alignItems: 'flex-end' }}><Text selectable style={{ color: colors.inkMuted, ...rtlText }}>الكل</Text><Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: '800' }}>{stats.totalCards}</Text></View>
          <View style={{ alignItems: 'flex-end' }}><Text selectable style={{ color: colors.inkMuted, ...rtlText }}>جديدة</Text><Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: '800' }}>{stats.newCards}</Text></View>
          <View style={{ alignItems: 'flex-end' }}><Text selectable style={{ color: colors.inkMuted, ...rtlText }}>بتتعلمها</Text><Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: '800' }}>{stats.learningCards}</Text></View>
          <View style={{ alignItems: 'flex-end' }}><Text selectable style={{ color: colors.inkMuted, ...rtlText }}>ثابتة</Text><Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: '800' }}>{stats.strongCards}</Text></View>
        </View>
        <Text selectable style={{ color: colors.inkMuted, lineHeight: 22, ...rtlText }}>“ثابتة” معناها إن نظام المراجعة شايف إن الكارت بقى قوي، مش معناها إنك مستحيل تنساه بعد كده.</Text>
      </Surface>
    </ScrollView>
  );
}
