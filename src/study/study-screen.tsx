import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { ReviewGrade } from '@/domain/types';
import { CatalogRepository } from '@/data/catalog';
import { asSqlDatabase, type SqlDatabase } from '@/data/database';
import { ReviewEventRepository, UserCardStateRepository } from '@/data/repositories';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { ActionButton, EmptyState, ProgressBar, Surface } from '@/components/primitives';
import { SwipeGradeCard } from '@/components/swipe-grade-card';
import { colors, spacing, typography } from '@/theme/tokens';
import { SimpleReviewScheduler } from './scheduler';
import { ScopedStudyDataSource } from './scoped-source';
import { StudySessionService, type StudySession, type StudySessionSnapshot } from './session';
import { getActiveStudySession, setActiveStudySession } from './session-store';

function buildStudyService(db: SqlDatabase, languagePairId: string): StudySessionService {
  return new StudySessionService(
    new ScopedStudyDataSource(db, languagePairId),
    new ReviewEventRepository(db),
    new UserCardStateRepository(db),
    new SimpleReviewScheduler(),
  );
}

export function StudyScreen() {
  const sqlite = useSQLiteContext();
  const db = asSqlDatabase(sqlite);
  const { loading: pairLoading, pair } = useActiveLanguagePair();
  const [session, setSession] = useState<StudySession | null>(null);
  const [snapshot, setSnapshot] = useState<StudySessionSnapshot | null>(null);
  const [totalCards, setTotalCards] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardStartedAt = useRef<number | null>(null);
  const recallMs = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      if (!pair) {
        setSession(null);
        setSnapshot(null);
        setTotalCards(0);
        return;
      }
      try {
        const count = (await new CatalogRepository(db).listBank(pair.id)).length;
        const existing = getActiveStudySession(pair.id);
        const next = existing ?? (await buildStudyService(db, pair.id).createSession());
        if (cancelled) return;
        setActiveStudySession(next, pair.id);
        setTotalCards(count);
        setSession(next);
        setSnapshot(next.snapshot);
        setRevealed(false);
        recallMs.current = null;
        cardStartedAt.current = Date.now();
        setError(null);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not start the study session.');
      }
    }
    if (!pairLoading) void initialize();
    return () => { cancelled = true; };
  }, [db, pair, pairLoading]);

  async function restartSession() {
    if (!pair) return;
    setError(null);
    setRevealed(false);
    setSubmitting(false);
    recallMs.current = null;
    try {
      const next = await buildStudyService(db, pair.id).createSession();
      setActiveStudySession(next, pair.id);
      setSession(next);
      setSnapshot(next.snapshot);
      setTotalCards((await new CatalogRepository(db).listBank(pair.id)).length);
      cardStartedAt.current = Date.now();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not restart the study session.');
    }
  }

  async function grade(gradeValue: ReviewGrade) {
    if (!session || !snapshot?.current || !revealed || submitting) return;
    setSubmitting(true);
    try {
      const accepted = await session.gradeCurrent(gradeValue, recallMs.current);
      if (!accepted) return;
      setSnapshot(session.snapshot);
      setRevealed(false);
      cardStartedAt.current = Date.now();
      recallMs.current = null;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this review.');
    } finally {
      setSubmitting(false);
    }
  }

  if (pairLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="Preparing study" /></View>;
  if (!pair) return <EmptyState title="What are you learning?" body="Choose a learning language and the language you want explanations in. You can stay a guest and change this later." action={<Link href="/settings" asChild><ActionButton label="Choose languages" /></Link>} />;
  if (error) return <EmptyState title="Study hit a snag" body={error} action={<ActionButton label="Try again" onPress={() => void restartSession()} />} />;
  if (!snapshot || totalCards === null) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="Loading study session" /></View>;
  if (totalCards === 0) return <EmptyState title="Your bank is empty" body={`Add your first ${pair.targetLanguageName} word or phrase, then come back here to practice it.`} action={<Link href="/add" asChild><ActionButton label="Add vocabulary" /></Link>} />;
  if (snapshot.completed && snapshot.summary.reviewed === 0) return <EmptyState title="Nothing due right now" body="You are caught up. Come back when your next review is due, or browse your bank." action={<Link href="/bank" asChild><ActionButton label="Open vocabulary bank" /></Link>} />;

  if (snapshot.completed) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <Surface style={{ width: '100%', maxWidth: 520, padding: spacing.xl, gap: spacing.lg }}>
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800', textAlign: 'center' }}>Session complete</Text>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, textAlign: 'center', lineHeight: 25 }}>{snapshot.summary.reviewed} reviews · {snapshot.summary.knew} knew · {snapshot.summary.forgot} forgot · {snapshot.summary.retries} retries</Text>
          <ActionButton label="Check for due cards" onPress={() => { setActiveStudySession(null); void restartSession(); }} />
          <Link href="/bank" asChild><ActionButton label="Vocabulary bank" /></Link>
        </Surface>
      </ScrollView>
    );
  }

  const current = snapshot.current;
  if (!current) return null;
  const progress = snapshot.reviewedCount / Math.max(snapshot.plannedTotal, 1);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ width: '100%', maxWidth: 580, flex: 1, gap: spacing.md }}>
        <View style={{ gap: spacing.sm }} accessibilityLiveRegion="polite">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontVariant: ['tabular-nums'] }}>{snapshot.reviewedCount + 1} / {snapshot.plannedTotal}</Text>
            <Text selectable style={{ color: current.isRetry ? colors.danger : colors.inkMuted, fontSize: typography.label, fontWeight: '800' }}>{current.isRetry ? 'RETRY' : pair.targetLanguageName.toUpperCase()}</Text>
          </View>
          <ProgressBar value={progress} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', minHeight: 390 }}>
          <SwipeGradeCard key={current.queueId} card={current.card} revealed={revealed} disabled={submitting} onReveal={() => { const now = Date.now(); recallMs.current = Math.max(0, now - (cardStartedAt.current ?? now)); setRevealed(true); }} onGrade={(value) => void grade(value)} />
        </View>
        <View accessibilityRole="toolbar" style={{ flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm }}>
          <View style={{ flex: 1 }}><ActionButton accessibilityLabel="I forgot this word" label="← Forgot" tone="danger" disabled={!revealed || submitting} onPress={() => void grade('FORGOT')} /></View>
          <View style={{ flex: 1 }}><ActionButton accessibilityLabel="I knew this word" label="Knew it →" tone="success" disabled={!revealed || submitting} onPress={() => void grade('KNEW')} /></View>
        </View>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, textAlign: 'center', paddingBottom: spacing.sm }}>{revealed ? 'Swipe or use the buttons to grade your recall.' : 'Think first. Tap the card to reveal.'}</Text>
      </View>
    </ScrollView>
  );
}
