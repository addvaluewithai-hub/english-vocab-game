import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { ReviewGrade } from '@/domain/types';
import { asSqlDatabase } from '@/data/database';
import { ReviewEventRepository, UserCardStateRepository, VocabularyRepository } from '@/data/repositories';
import { ActionButton, EmptyState, ProgressBar } from '@/components/primitives';
import { SwipeGradeCard } from '@/components/swipe-grade-card';
import { colors, spacing, typography } from '@/theme/tokens';
import { SimpleReviewScheduler } from './scheduler';
import { StudySessionService, type StudySession, type StudySessionSnapshot } from './session';
import { getActiveStudySession, setActiveStudySession } from './session-store';

function buildStudyService(db: ReturnType<typeof asSqlDatabase>) {
  const vocabulary = new VocabularyRepository(db);
  const events = new ReviewEventRepository(db);
  const states = new UserCardStateRepository(db);
  return { vocabulary, service: new StudySessionService(vocabulary, events, states, new SimpleReviewScheduler()) };
}

export function StudyScreen() {
  const sqlite = useSQLiteContext();
  const db = asSqlDatabase(sqlite);
  const [{ vocabulary, service }] = useState(() => buildStudyService(db));
  const [session, setSession] = useState<StudySession | null>(() => getActiveStudySession());
  const [snapshot, setSnapshot] = useState<StudySessionSnapshot | null>(() => getActiveStudySession()?.snapshot ?? null);
  const [totalCards, setTotalCards] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardStartedAt = useRef(Date.now());
  const recallMs = useRef<number | null>(null);

  const startSession = useCallback(async (forceNew = false) => {
    setError(null);
    setRevealed(false);
    try {
      const count = await vocabulary.countCards();
      setTotalCards(count);
      const existing = forceNew ? null : getActiveStudySession();
      const next = existing ?? (await service.createSession());
      setActiveStudySession(next);
      setSession(next);
      setSnapshot(next.snapshot);
      cardStartedAt.current = Date.now();
      recallMs.current = null;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the study session.');
    }
  }, [service, vocabulary]);

  useEffect(() => {
    if (!session) void startSession();
  }, [session, startSession]);

  const grade = useCallback(async (gradeValue: ReviewGrade) => {
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
  }, [revealed, session, snapshot?.current, submitting]);

  if (error) {
    return <EmptyState title="Study hit a snag" body={error} action={<ActionButton label="Try again" onPress={() => void startSession(true)} />} />;
  }
  if (!snapshot || totalCards === null) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="Loading study session" /></View>;
  }
  if (totalCards === 0) {
    return <EmptyState title="Your bank is empty" body="Add your first word or phrase, then come back here to practice it." action={<Link href="/add" asChild><ActionButton label="Add vocabulary" /></Link>} />;
  }
  if (snapshot.completed && snapshot.summary.reviewed === 0) {
    return <EmptyState title="Nothing due right now" body="You are caught up. Come back when your next review is due." action={<Link href="/bank" asChild><ActionButton label="Open vocabulary bank" /></Link>} />;
  }
  if (snapshot.completed) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <Text selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800', textAlign: 'center' }}>Session complete</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, textAlign: 'center', lineHeight: 25 }}>
          {snapshot.summary.reviewed} reviews · {snapshot.summary.knew} knew · {snapshot.summary.forgot} forgot · {snapshot.summary.retries} retries
        </Text>
        <View style={{ gap: spacing.sm }}>
          <ActionButton label="Check for due cards" onPress={() => { setActiveStudySession(null); setSession(null); setSnapshot(null); void startSession(true); }} />
          <Link href="/bank" asChild><ActionButton label="Vocabulary bank" /></Link>
        </View>
      </ScrollView>
    );
  }

  const current = snapshot.current;
  if (!current) return null;
  const progress = snapshot.reviewedCount / Math.max(snapshot.plannedTotal, 1);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md }}
      style={{ flex: 1, backgroundColor: colors.canvas }}
    >
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, fontVariant: ['tabular-nums'] }}>{snapshot.reviewedCount + 1} / {snapshot.plannedTotal}</Text>
          {current.isRetry ? <Text selectable style={{ color: colors.danger, fontSize: typography.label, fontWeight: '800' }}>RETRY</Text> : null}
        </View>
        <ProgressBar value={progress} />
      </View>
      <View style={{ flex: 1, justifyContent: 'center', minHeight: 420 }}>
        <SwipeGradeCard
          key={current.queueId}
          card={current.card}
          revealed={revealed}
          disabled={submitting}
          onReveal={() => { recallMs.current = Math.max(0, Date.now() - cardStartedAt.current); setRevealed(true); }}
          onGrade={(value) => void grade(value)}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.md }}>
        <View style={{ flex: 1 }}><ActionButton label="← Forgot" tone="danger" disabled={!revealed || submitting} onPress={() => void grade('FORGOT')} /></View>
        <View style={{ flex: 1 }}><ActionButton label="Knew it →" tone="success" disabled={!revealed || submitting} onPress={() => void grade('KNEW')} /></View>
      </View>
      {!revealed ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, textAlign: 'center', paddingBottom: spacing.sm }}>Think first. Reveal before grading.</Text> : null}
    </ScrollView>
  );
}
