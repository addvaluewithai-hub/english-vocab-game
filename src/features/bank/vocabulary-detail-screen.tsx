import { useEffect, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Link, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { CatalogRepository, type VocabularyDetail } from '@/data/catalog';
import { asSqlDatabase } from '@/data/database';
import { colors, spacing, typography } from '@/theme/tokens';

function sourceLocator(context: VocabularyDetail['contexts'][number]): string | null {
  if (context.pageNumber) return `Page ${context.pageNumber}`;
  if (context.timestampSeconds !== null) {
    const minutes = Math.floor(context.timestampSeconds / 60);
    const seconds = Math.floor(context.timestampSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
  return null;
}

async function readVocabularyDetail(sqlite: SQLiteDatabase, cardId: string): Promise<VocabularyDetail | null> {
  return new CatalogRepository(asSqlDatabase(sqlite)).getDetail(cardId);
}

export function VocabularyDetailScreen() {
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const sqlite = useSQLiteContext();
  const [detail, setDetail] = useState<VocabularyDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    if (!cardId) return;
    setDetail(await readVocabularyDetail(sqlite, cardId));
    setError(null);
  }

  useEffect(() => {
    if (!cardId) return;
    let cancelled = false;

    void readVocabularyDetail(sqlite, cardId)
      .then((next) => {
        if (!cancelled) {
          setDetail(next);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load vocabulary.');
      });

    return () => {
      cancelled = true;
    };
  }, [cardId, sqlite]);

  if (error) return <EmptyState title="Could not open vocabulary" body={error} />;
  if (detail === undefined) return <EmptyState title="Loading…" body="Opening vocabulary details." />;
  if (!detail) return <EmptyState title="Vocabulary not found" body="It may have been archived or removed." />;

  const knew = detail.reviews.filter((item) => item.grade === 'KNEW').length;
  const accuracy = detail.reviews.length ? Math.round((knew / detail.reviews.length) * 100) : null;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}><Chip>{detail.termKind}</Chip><Chip>{detail.lifecycle}</Chip>{detail.partOfSpeech ? <Chip>{detail.partOfSpeech}</Chip> : null}</View>
        <Text selectable style={{ color: colors.ink, fontSize: 38, lineHeight: 46, fontWeight: '900' }}>{detail.term}</Text>
        {detail.pronunciationText ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body }}>{detail.pronunciationText}</Text> : null}
        <Text selectable style={{ color: colors.ink, fontSize: 28, lineHeight: 38, fontWeight: '800' }}>{detail.translation}</Text>
        {detail.definition ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25 }}>{detail.definition}</Text> : null}
        {detail.note ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 21 }}>Note: {detail.note}</Text> : null}
      </View>
      <Link href={{ pathname: '/add', params: { cardId: detail.cardId } }} asChild><ActionButton label="Edit vocabulary" /></Link>

      <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: '800' }}>Learning</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body }}>{detail.reviews.length} reviews{accuracy === null ? ' · not reviewed yet' : ` · ${accuracy}% remembered`}</Text>
        {detail.nextDueAt ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label }}>Next due: {new Date(detail.nextDueAt).toLocaleString()}</Text> : null}
      </Surface>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Where you met it</Text>
        {detail.contexts.length ? detail.contexts.map((context) => (
          <Surface key={context.id} style={{ padding: spacing.md, gap: spacing.sm }}>
            {context.sentence ? <Text selectable style={{ color: colors.ink, fontSize: typography.body, lineHeight: 25 }}>“{context.sentence}”</Text> : null}
            {context.sourceTitle ? <Text selectable style={{ color: colors.inkMuted }}>{context.sourceTitle}{sourceLocator(context) ? ` · ${sourceLocator(context)}` : ''}</Text> : null}
            {context.sourceUri ? <ActionButton label="Open source" onPress={() => void Linking.openURL(context.sourceUri!)} /> : null}
          </Surface>
        )) : <Text selectable style={{ color: colors.inkMuted }}>No source context saved yet.</Text>}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Collections</Text>
        {detail.collections.length ? detail.collections.map((collection) => (
          <Surface key={collection.id} style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text selectable style={{ flex: 1, color: colors.ink, fontWeight: '700' }}>{collection.name}</Text>
            <ActionButton label="Remove" tone="danger" onPress={() => void new CatalogRepository(asSqlDatabase(sqlite)).removeFromCollection(detail.cardId, collection.id).then(reload)} />
          </Surface>
        )) : <Text selectable style={{ color: colors.inkMuted }}>Not in a collection.</Text>}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Review history</Text>
        {detail.reviews.length ? detail.reviews.slice(0, 30).map((review) => (
          <View key={review.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.xs }}>
            <Text selectable style={{ color: review.grade === 'KNEW' ? colors.success : colors.danger, fontWeight: '800' }}>{review.grade === 'KNEW' ? 'Remembered' : 'Forgot'}</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>{new Date(review.reviewedAt).toLocaleString()}</Text>
          </View>
        )) : <Text selectable style={{ color: colors.inkMuted }}>No reviews yet.</Text>}
      </View>
    </ScrollView>
  );
}
