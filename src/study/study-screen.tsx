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
      accessibilityLabel={value === 'ALL' ? 'All due cards' : `${value} cards`}
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
        {value === 'ALL' ? 'All' : value}
      </Text>
      <Text selectable style={{ color: selected ? colors.surfaceMuted : colors.inkMuted, fontSize: typography.small }}>
        {value === 'ALL' ? 'due cards' : 'cards'}
      </Text>
    </Pressable>
  );
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
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not prepare study.');
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
      setError(caught instanceof Error ? caught.message : 'Could not prepare the next round.');
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
      setError(caught instanceof Error ? caught.message : 'Could not start this round.');
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
      setError(caught instanceof Error ? caught.message : 'Could not save this review.');
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
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="Preparing study" /></View>;
  }
  if (!pair) {
    return <EmptyState title="Preparing English" body="The app starts with English → Arabic automatically. Reopen the screen if setup was interrupted." action={<ActionButton label="Try again" onPress={() => void prepareRound()} />} />;
  }
  if (error) return <EmptyState title="Study hit a snag" body={error} action={<ActionButton label="Try again" onPress={() => void prepareRound()} />} />;
  if (totalCards === 0) return <EmptyState title="Your bank is empty" body="Add a course mission, an image, or a word, then start a quick round." action={<Link href="/add" asChild><ActionButton label="Add vocabulary" /></Link>} />;

  if (!session || !snapshot) {
    if (dueCards === 0) {
      return <EmptyState title="Nothing due right now" body="You are caught up. Add more vocabulary or come back when the next review is due." action={<Link href="/add" asChild><ActionButton label="Add more vocabulary" /></Link>} />;
    }
    const chosenCount = roundSize === 'ALL' ? dueCards : Math.min(roundSize, dueCards);
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <Surface style={{ width: '100%', maxWidth: 540, padding: spacing.xl, gap: spacing.lg }}>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text aria-hidden style={{ fontSize: 44 }}>⚡</Text>
            <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '900', textAlign: 'center' }}>Quick round</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 24, textAlign: 'center' }}>
              {dueCards} cards are ready. Pick how many you want in this round.
            </Text>
          </View>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {ROUND_SIZES.map((value) => (
              <RoundSizeButton key={String(value)} value={value} selected={roundSize === value} onPress={() => setRoundSize(value)} />
            ))}
          </View>
          <Surface style={{ padding: spacing.md, backgroundColor: colors.surfaceMuted }}>
            <Text selectable style={{ color: colors.ink, fontSize: typography.label, fontWeight: '800', textAlign: 'center' }}>Swipe right = I know it · Swipe left = study again</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, textAlign: 'center', marginTop: 4 }}>Flip is optional. Use it only when you need to check the answer.</Text>
          </Surface>
          <ActionButton label={starting ? 'Starting…' : `Start ${chosenCount}-card round`} disabled={starting} onPress={() => void startRound()} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg }}>
            <Link href="/course-library" style={{ color: colors.accent, fontWeight: '800' }}>Course missions</Link>
            <Link href="/add" style={{ color: colors.accent, fontWeight: '800' }}>Add vocabulary</Link>
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
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800', textAlign: 'center' }}>Round complete</Text>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, textAlign: 'center', lineHeight: 25 }}>{snapshot.summary.reviewed} reviews · {snapshot.summary.knew} knew · {snapshot.summary.forgot} forgot · {snapshot.summary.retries} retries</Text>
          <ActionButton label={starting ? 'Checking…' : 'Choose next round'} disabled={starting} onPress={() => void prepareRound()} />
          <Link href="/stats" asChild><ActionButton label="See learning stats" /></Link>
          <Link href="/bank" asChild><ActionButton label="Vocabulary bank" /></Link>
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
            <Text selectable style={{ color: current.isRetry ? colors.danger : colors.inkMuted, fontSize: typography.label, fontWeight: '800' }}>{current.isRetry ? 'RETRY' : mode.replaceAll('_', ' ')}</Text>
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
          <View style={{ flex: 1 }}><ActionButton accessibilityLabel="I forgot this word" label="← Forgot" tone="danger" disabled={submitting} onPress={() => void grade('FORGOT')} /></View>
          <View style={{ flex: 1 }}><ActionButton accessibilityLabel="I knew this word" label="Knew it →" tone="success" disabled={submitting} onPress={() => void grade('KNEW')} /></View>
        </View> : null}
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, textAlign: 'center', paddingBottom: spacing.sm }}>
          {mode === 'TYPING' ? 'Typing is checked automatically.' : revealed ? 'Swipe anytime, or use the buttons.' : 'Know it already? Swipe right immediately. Need the answer? Tap to reveal.'}
        </Text>
      </View>
    </ScrollView>
  );
}
