import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { ImportJobRepository, type ImportJob } from '@/imports/jobs';
import { colors, spacing, typography } from '@/theme/tokens';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

function statusCopy(job: ImportJob): string {
  if (job.status === 'QUEUED') return 'مستني دوره عشان يبدأ التحليل.';
  if (job.status === 'PROCESSING') return 'Gemini بيحلل المصدر وبيطلع الكلمات. تقدر تسيب الشاشة وترجع بعدين.';
  if (job.status === 'NEEDS_REVIEW') return `${job.candidates?.length ?? 0} كلمة وعبارة جاهزين للمراجعة.`;
  if (job.status === 'COMPLETED') return 'خلصنا المراجعة والتعامل مع الكلمات المختارة.';
  if (job.status === 'CANCELLED') return 'وقّفنا العملية من غير ما نضيف حاجة تلقائي.';
  return job.errorMessage ?? 'الإضافة وقفت قبل ما الكلمات توصل لبنكك.';
}

function statusLabel(status: ImportJob['status']): string {
  if (status === 'QUEUED') return 'مستني';
  if (status === 'PROCESSING') return 'بيتحلل';
  if (status === 'NEEDS_REVIEW') return 'راجع الكلمات';
  if (status === 'COMPLETED') return 'خلص';
  if (status === 'CANCELLED') return 'متوقف';
  return 'فيه مشكلة';
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
    setMessage(updated.status === 'QUEUED' ? 'تمام، رجعناه للطابور وهيحاول تاني بنفس المصدر.' : 'العملية دي مش محتاجة إعادة محاولة دلوقتي.');
    if (pair) await reload(pair.id);
  }

  async function cancel(job: ImportJob): Promise<void> {
    await new ImportJobRepository(sqlite).cancel(job.id);
    setMessage('وقّفنا الإضافة. مفيش كلمات اتضافت تلقائي.');
    if (pair) await reload(pair.id);
  }

  if (pairLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="بنحمّل الإضافات" /></View>;
  if (!pair) return <EmptyState title="بنجهز الإنجليزي" body="English → Arabic بيتعمل تلقائي أول ما تفتح التطبيق." />;
  if (jobs === null) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="بنحمّل الإضافات" /></View>;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '900', ...rtlText }}>الإضافات الذكية</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25, ...rtlText }}>هات نص، صور، PDF، فيديو يوتيوب عام، أو لينك. Gemini يطلع الكلمات الأول وإنت تختار اللي يستاهل كارت.</Text>
      </View>

      <Surface style={{ padding: spacing.lg, gap: spacing.md, backgroundColor: colors.ink }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.md }}>
          <Text aria-hidden style={{ fontSize: 38 }}>✨</Text>
          <View style={{ flex: 1, gap: spacing.xs, alignItems: 'flex-end' }}>
            <Text selectable style={{ color: colors.surface, fontSize: 21, fontWeight: '900', ...rtlText }}>إضافة ذكية بـ Gemini</Text>
            <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.label, lineHeight: 21, ...rtlText }}>بنطلع المرشحين الأول، وبعد اختيارك بس نعمل الترجمة والأمثلة عشان نوفر الاستخدام.</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm }}>
          <Chip>✍️ نص</Chip><Chip>🖼️ صور</Chip><Chip>📄 PDF</Chip><Chip>▶️ يوتيوب</Chip><Chip>🌐 لينك</Chip>
        </View>
        <Link href="/smart-import" asChild><ActionButton label="ابدأ إضافة ذكية" /></Link>
      </Surface>

      <Surface style={{ padding: spacing.md, gap: spacing.xs, alignItems: 'flex-end' }}>
        <Text selectable style={{ color: colors.ink, fontWeight: '900', ...rtlText }}>بتشتغل إزاي؟</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 20, ...rtlText }}>1. Gemini يطلع الكلمات والعبارات المفيدة. 2. إنت تختار. 3. يترجم المختار ويكتب أمثلة. 4. تراجع وتعدّل. 5. تضيف لبنك كلماتك.</Text>
      </Surface>

      {message ? <Surface style={{ padding: spacing.md }}><Text accessibilityLiveRegion="polite" selectable style={{ color: colors.inkMuted, ...rtlText }}>{message}</Text></Surface> : null}
      {jobs.length ? (
        <View style={{ gap: spacing.md }}>
          <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: '900', ...rtlText }}>محاولات سابقة</Text>
          {jobs.map((job) => (
            <Surface key={job.id} style={{ padding: spacing.md, gap: spacing.sm }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1, gap: spacing.xs, alignItems: 'flex-end' }}>
                  <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: '800', ...rtlText }}>{job.sourceLabel || `إضافة من ${job.sourceType}`}</Text>
                  <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, ...rtlText }}>{new Date(job.updatedAt).toLocaleString('ar-EG')}</Text>
                </View>
                <Chip>{statusLabel(job.status)}</Chip>
              </View>
              <Text selectable style={{ color: colors.inkMuted, lineHeight: 22, ...rtlText }}>{statusCopy(job)}</Text>
              {job.status === 'NEEDS_REVIEW' ? <Link href="/import-staging" asChild><ActionButton label="راجع الكلمات" /></Link> : null}
              {job.status === 'FAILED' || job.status === 'CANCELLED' ? <ActionButton label="جرّب تاني" onPress={() => void retry(job)} /> : null}
              {job.status === 'QUEUED' || job.status === 'PROCESSING' ? <ActionButton label="وقّف الإضافة" tone="danger" onPress={() => void cancel(job)} /> : null}
            </Surface>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
