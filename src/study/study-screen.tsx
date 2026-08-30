import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { ReviewGrade, ReviewModeResult } from '@/domain/types';
import { CatalogRepository } from '@/data/catalog';
import { asSqlDatabase, type SqlDatabase } from '@/data/database';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { ActionButton, EmptyState, ProgressBar, Surface } from '@/components/primitives';
import { RecallModeCard } from '@/components/recall-mode-card';
import { SwipeGradeCard } from '@/components/swipe-grade-card';
import { VocabularyCard } from '@/components/vocabulary-card';
import { reconcileReviewReminder } from '@/notifications/review-reminders';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { LearningCardStateRepository, LearningReviewEventRepository } from './learning-repositories';
import { gradeTypedAnswer, selectRecallMode } from './recall-modes';
import { FsrsReviewScheduler } from './scheduler';
import { ScopedStudyDataSource } from './scoped-source';
import { StudySessionService, type StudySession, type StudySessionSnapshot } from './session';
import { getActiveStudySession, setActiveStudySession } from './session-store';

type RoundSize = 5 | 10 | 20 | 'ALL';
const ROUND_SIZES: readonly RoundSize[] = [5, 10, 20, 'ALL'];
const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

function buildStudyService(db: SqlDatabase, languagePairId: string): StudySessionService {
  return new StudySessionService(
    new ScopedStudyDataSource(db, languagePairId),
    new LearningReviewEventRepository(db),
    new LearningCardStateRepository(db),
    new FsrsReviewScheduler(),
  );
}

function RoundSizeButton({ value, selected, onPress }: { value: RoundSize; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={value === 'ALL' ? 'كل الكلمات الجاهزة' : `${value} كلمات`}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 70,
        paddingVertical: 13,
        paddingHorizontal: 10,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.ink : colors.surface,
        alignItems: 'center',
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Text selectable style={{ color: selected ? colors.surface : colors.ink, fontSize: typography.body, fontWeight: '900' }}>
        {value === 'ALL' ? 'الكل' : value}
      </Text>
      <Text selectable style={{ color: selected ? colors.surfaceMuted : colors.inkMuted, fontSize: typography.small, ...rtlText }}>
        {value === 'ALL' ? 'الجاهز' : 'كلمات'}
      </Text>
    </Pressable>
  );
}

function modeLabel(mode: string): string {
  if (mode === 'TARGET_TO_MEANING') return 'المعنى';
  if (mode === 'MEANING_TO_TARGET') return 'العكس';
  if (mode === 'CLOZE') return 'من السياق';
  if (mode === 'LISTENING') return 'اسمع';
  if (mode === 'TYPING') return 'اكتب';
  return mode;
}

export function StudyScreen() {
  const sqlite = useSQLiteContext();
  const db = asSqlDatabase(sqlite);
  const { loading: pairLoading, pair } = useActiveLanguagePair();
  const [session, setSession] = useState<StudySession | null>(null);
  const [snapshot, setSnapshot] = useState<StudySessionSnapshot | null>(null);
  const [totalCards, setTotalCards] = useState<number | null>(null);
  const [dueCards, setDueCards] = useState<number | null>(null);
  const [roundSize, setRoundSize] = useState<RoundSize>(10);
  const [revealed, setRevealed] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardStartedAt = useRef<number | null>(null);
  const recallMs = useRef<number | null>(null);

  function resetCardUi() {
    setRevealed(false);
    setTypedAnswer('');
    recallMs.current = null;
    cardStartedAt.current = Date.now();
  }

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      if (!pair) {
        setSession(null);
        setSnapshot(null);
        setTotalCards(0);
        setDueCards(0);
        return;
      }
      try {
        const service = buildStudyService(db, pair.id);
        const [count, due] = await Promise.all([
          new CatalogRepository(db).listBank(pair.id).then((items) => items.length),
          service.countDue(),
        ]);
        const existing = getActiveStudySession(pair.id);
        if (cancelled) return;
        setTotalCards(count);
        setDueCards(due);
        setError(null);
        if (existing && !existing.snapshot.completed) {
          setSession(existing);
          setSnapshot(existing.snapshot);
          resetCardUi();
        } else {
          setActiveStudySession(null);
          setSession(null);
          setSnapshot(null);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'مقدرناش نجهز المذاكرة.');
      }
    }
    if (!pairLoading) void initialize();
    return () => { cancelled = true; };
  }, [db, pair, pairLoading]);

  async function prepareRound() {
    if (!pair) return;
    setStarting(true);
    setError(null);
    setSubmitting(false);
    try {
      setActiveStudySession(null);
      const service = buildStudyService(db, pair.id);
      const [count, due] = await Promise.all([
        new CatalogRepository(db).listBank(pair.id).then((items) => items.length),
        service.countDue(),
      ]);
      setTotalCards(count);
      setDueCards(due);
      setSession(null);
      setSnapshot(null);
      setRevealed(false);
      setTypedAnswer('');
      recallMs.current = null;
      cardStartedAt.current = null;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'مقدرناش نجهز الراوند الجاية.');
    } finally {
      setStarting(false);
    }
  }

  async function startRound() {
    if (!pair || !dueCards || starting) return;
    setStarting(true);
    setError(null);
    try {
      const limit = roundSize === 'ALL' ? undefined : roundSize;
      const next = await buildStudyService(db, pair.id).createSession(new Date(), limit);
      setActiveStudySession(next, pair.id);
      setSession(next);
      setSnapshot(next.snapshot);
      resetCardUi();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'مقدرناش نبدأ الراوند.');
    } finally {
      setStarting(false);
    }
  }

  function captureRecallTime() {
    const now = Date.now();
    recallMs.current = Math.max(0, now - (cardStartedAt.current ?? now));
  }

  async function grade(gradeValue: ReviewGrade, modeResult: ReviewModeResult = 'SELF_GRADED') {
    const current = snapshot?.current;
    if (!session || !current || !pair || submitting) return;
    if (recallMs.current === null) captureRecallTime();
    const mode = selectRecallMode(current.card);
    setSubmitting(true);
    try {
      const accepted = await session.gradeCurrent(gradeValue, recallMs.current, new Date(), { recallMode: mode, modeResult });
      if (!accepted) return;
      setSnapshot(session.snapshot);
      resetCardUi();
      void reconcileReviewReminder(sqlite, pair.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'مقدرناش نسجل إجابتك.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTyping() {
    const current = snapshot?.current;
    if (!current || submitting || !typedAnswer.trim()) return;
    captureRecallTime();
    const correct = gradeTypedAnswer(current.card, typedAnswer);
    await grade(correct ? 'KNEW' : 'FORGOT', correct ? 'CORRECT' : 'INCORRECT');
  }

  if (pairLoading || totalCards === null || dueCards === null) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="بنجهز المذاكرة" /></View>;
  }
  if (!pair) {
    return <EmptyState title="بنجهز الإنجليزي" body="English → Arabic بيتعمل تلقائي. لو التحضير وقف، افتح الشاشة تاني." action={<ActionButton label="جرّب تاني" onPress={() => void prepareRound()} />} />;
  }
  if (error) return <EmptyState title="حصلت مشكلة في المذاكرة" body={error} action={<ActionButton label="جرّب تاني" onPress={() => void prepareRound()} />} />;
  if (totalCards === 0) return <EmptyState title="لسه معندكش كلمات" body="خد مهمة من الكورس أو ضيف كلمات من عندك، وبعدها ابدأ راوند." action={<Link href="/add" asChild><ActionButton label="ضيف كلمات" /></Link>} />;

  if (!session || !snapshot) {
    if (dueCards === 0) {
      return <EmptyState title="مفيش حاجة محتاجة مراجعة دلوقتي" body="إنت مخلص اللي عليك. ضيف كلمات جديدة أو ارجع لما ييجي معاد المراجعة الجاية." action={<Link href="/add" asChild><ActionButton label="ضيف كلمات جديدة" /></Link>} />;
    }
    const chosenCount = roundSize === 'ALL' ? dueCards : Math.min(roundSize, dueCards);
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <Surface style={{ width: '100%', maxWidth: 540, padding: spacing.xl, gap: spacing.lg }}>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text aria-hidden style={{ fontSize: 44 }}>⚡</Text>
            <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' }}>راوند سريعة</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25, textAlign: 'center', writingDirection: 'rtl' }}>
              عندك {dueCards} كلمة جاهزة. اختار كام كلمة عايز تراجعهم في الراوند دي.
            </Text>
          </View>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {ROUND_SIZES.map((value) => (
              <RoundSizeButton key={String(value)} value={value} selected={roundSize === value} onPress={() => setRoundSize(value)} />
            ))}
          </View>
          <Surface style={{ padding: spacing.md, backgroundColor: colors.surfaceMuted }}>
            <Text selectable style={{ color: colors.ink, fontSize: typography.label, fontWeight: '800', textAlign: 'center', writingDirection: 'rtl' }}>يمين = عارفها · شمال = راجعها تاني</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, textAlign: 'center', marginTop: 4, writingDirection: 'rtl' }}>مش لازم تقلب الكارت. اقلبه بس لو محتاج تشوف الإجابة.</Text>
          </Surface>
          <ActionButton label={starting ? 'بنبدأ…' : `ابدأ راوند ${chosenCount} كلمة`} disabled={starting} onPress={() => void startRound()} />
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', gap: spacing.lg }}>
            <Link href="/course-library" style={{ color: colors.accent, fontWeight: '800' }}>مهمات الكورس</Link>
            <Link href="/add" style={{ color: colors.accent, fontWeight: '800' }}>ضيف كلمات</Link>
          </View>
        </Surface>
      </ScrollView>
    );
  }

  if (snapshot.completed) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <Surface style={{ width: '100%', maxWidth: 520, padding: spacing.xl, gap: spacing.lg }}>
          <Text aria-hidden style={{ fontSize: 42, textAlign: 'center' }}>🏁</Text>
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800', textAlign: 'center', writingDirection: 'rtl' }}>خلصت الراوند 👏</Text>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, textAlign: 'center', lineHeight: 25, writingDirection: 'rtl' }}>{snapshot.summary.reviewed} مراجعة · {snapshot.summary.knew} عارفهم · {snapshot.summary.forgot} نسيتهم · {snapshot.summary.retries} إعادة</Text>
          <ActionButton label={starting ? 'بنشوف…' : 'اختار الراوند الجاية'} disabled={starting} onPress={() => void prepareRound()} />
          <Link href="/stats" asChild><ActionButton label="شوف تقدمك" /></Link>
          <Link href="/bank" asChild><ActionButton label="افتح كلماتي" /></Link>
        </Surface>
      </ScrollView>
    );
  }

  const current = snapshot.current;
  if (!current) return null;
  const progress = snapshot.reviewedCount / Math.max(snapshot.plannedTotal, 1);
  const mode = selectRecallMode(current.card);
  const reveal = () => {
    if (recallMs.current === null) captureRecallTime();
    setRevealed(true);
  };

  const cardBody = mode === 'TARGET_TO_MEANING'
    ? <VocabularyCard card={current.card} revealed={revealed} onReveal={reveal} />
    : <RecallModeCard card={current.card} mode={mode} revealed={revealed} typedAnswer={typedAnswer} disabled={submitting} onTypedAnswer={setTypedAnswer} onReveal={reveal} onSubmitTyping={() => void submitTyping()} />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ width: '100%', maxWidth: 580, flex: 1, gap: spacing.md }}>
        <View style={{ gap: spacing.sm }} accessibilityLiveRegion="polite">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontVariant: ['tabular-nums'] }}>{snapshot.reviewedCount + 1} / {snapshot.plannedTotal}</Text>
            <Text selectable style={{ color: current.isRetry ? colors.danger : colors.inkMuted, fontSize: typography.label, fontWeight: '800', writingDirection: 'rtl' }}>{current.isRetry ? 'إعادة' : modeLabel(mode)}</Text>
          </View>
          <ProgressBar value={progress} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', minHeight: 390 }}>
          {mode === 'TYPING' ? cardBody : (
            <SwipeGradeCard key={current.queueId} disabled={submitting} onGrade={(value) => void grade(value)}>
              {cardBody}
            </SwipeGradeCard>
          )}
        </View>
        {mode !== 'TYPING' ? <View accessibilityRole="toolbar" style={{ flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm }}>
          <View style={{ flex: 1 }}><ActionButton accessibilityLabel="نسيت الكلمة" label="← نسيتها" tone="danger" disabled={submitting} onPress={() => void grade('FORGOT')} /></View>
          <View style={{ flex: 1 }}><ActionButton accessibilityLabel="عارف الكلمة" label="عارفها →" tone="success" disabled={submitting} onPress={() => void grade('KNEW')} /></View>
        </View> : null}
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, textAlign: 'center', paddingBottom: spacing.sm, writingDirection: 'rtl' }}>
          {mode === 'TYPING' ? 'الإجابة المكتوبة بتتراجع تلقائي.' : revealed ? 'اسحب في أي وقت، أو استخدم الزرين.' : 'عارفها؟ اسحب يمين على طول. محتاج الإجابة؟ دوس على الكارت.'}
        </Text>
      </View>
    </ScrollView>
  );
}
