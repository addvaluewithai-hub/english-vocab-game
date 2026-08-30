import { useEffect, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Link, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { PronunciationButton } from '@/components/pronunciation-button';
import { CatalogRepository, type VocabularyDetail } from '@/data/catalog';
import { asSqlDatabase } from '@/data/database';
import { colors, spacing, typography } from '@/theme/tokens';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

function sourceLocator(context: VocabularyDetail['contexts'][number]): string | null {
  if (context.pageNumber) return `صفحة ${context.pageNumber}`;
  if (context.timestampSeconds !== null) {
    const minutes = Math.floor(context.timestampSeconds / 60);
    const seconds = Math.floor(context.timestampSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
  return null;
}

function kindLabel(kind: VocabularyDetail['termKind']): string {
  return kind === 'PHRASE' ? 'عبارة' : 'كلمة';
}

function lifecycleLabel(value: VocabularyDetail['lifecycle']): string {
  if (value === 'NEW') return 'جديدة';
  if (value === 'LEARNING') return 'بتتعلمها';
  if (value === 'STRONG') return 'ثابتة';
  return value;
}

interface DetailViewData {
  detail: VocabularyDetail;
  audioUri: string | null;
  imageUri: string | null;
}

async function readVocabularyDetail(sqlite: SQLiteDatabase, cardId: string): Promise<DetailViewData | null> {
  const detail = await new CatalogRepository(asSqlDatabase(sqlite)).getDetail(cardId);
  if (!detail) return null;
  const media = await sqlite.getFirstAsync<{ audio_uri: string | null; image_uri: string | null }>(
    'SELECT audio_uri, image_uri FROM senses WHERE id=? AND deleted_at IS NULL',
    detail.senseId,
  );
  return { detail, audioUri: media?.audio_uri ?? null, imageUri: media?.image_uri ?? null };
}

export function VocabularyDetailScreen() {
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const sqlite = useSQLiteContext();
  const [payload, setPayload] = useState<DetailViewData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    if (!cardId) return;
    setPayload(await readVocabularyDetail(sqlite, cardId));
    setError(null);
  }

  useEffect(() => {
    if (!cardId) return;
    let cancelled = false;
    void readVocabularyDetail(sqlite, cardId)
      .then((next) => {
        if (!cancelled) {
          setPayload(next);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'مقدرناش نفتح الكلمة دلوقتي.');
      });
    return () => { cancelled = true; };
  }, [cardId, sqlite]);

  if (error) return <EmptyState title="مقدرناش نفتح الكلمة" body={error} />;
  if (payload === undefined) return <EmptyState title="بنفتح الكلمة…" body="ثانية واحدة وبنجيب تفاصيلها." />;
  if (!payload) return <EmptyState title="الكلمة مش موجودة" body="ممكن تكون اتمسحت أو اتأرشفت." />;

  const { detail, audioUri } = payload;
  const knew = detail.reviews.filter((item) => item.grade === 'KNEW').length;
  const accuracy = detail.reviews.length ? Math.round((knew / detail.reviews.length) * 100) : null;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm }}>
          <Chip>{kindLabel(detail.termKind)}</Chip>
          <Chip>{lifecycleLabel(detail.lifecycle)}</Chip>
          {detail.partOfSpeech ? <Chip>{detail.partOfSpeech}</Chip> : null}
        </View>
        <Text selectable style={{ color: colors.ink, fontSize: 38, lineHeight: 46, fontWeight: '900' }}>{detail.term}</Text>
        <PronunciationButton uri={audioUri} pronunciation={detail.pronunciationText} />
        <Text selectable style={{ color: colors.ink, fontSize: 28, lineHeight: 38, fontWeight: '900', ...rtlText }}>{detail.translation}</Text>
        {detail.definition ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25 }}>{detail.definition}</Text> : null}
        {detail.contextSentence ? <Surface style={{ padding: spacing.md }}><Text selectable style={{ color: colors.ink, fontSize: typography.body, lineHeight: 25 }}>{detail.contextSentence}</Text></Surface> : null}
        {detail.note ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 21, ...rtlText }}>ملاحظتك: {detail.note}</Text> : null}
      </View>

      <Link href={{ pathname: '/add', params: { cardId: detail.cardId } }} asChild><ActionButton label="عدّل الكلمة" /></Link>

      <Surface style={{ padding: spacing.md, gap: spacing.sm, alignItems: 'flex-end' }}>
        <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: '900', ...rtlText }}>مستواك فيها</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, ...rtlText }}>{detail.reviews.length} مراجعة{accuracy === null ? ' · لسه ما راجعتهاش' : ` · افتكرتها ${accuracy}% من المرات`}</Text>
        {detail.nextDueAt ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, ...rtlText }}>المراجعة الجاية: {new Date(detail.nextDueAt).toLocaleString('ar-EG')}</Text> : null}
      </Surface>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>جتلك منين؟</Text>
        {detail.contexts.length ? detail.contexts.map((context) => (
          <Surface key={context.id} style={{ padding: spacing.md, gap: spacing.sm }}>
            {context.sentence ? <Text selectable style={{ color: colors.ink, fontSize: typography.body, lineHeight: 25 }}>“{context.sentence}”</Text> : null}
            {context.sourceTitle ? <Text selectable style={{ color: colors.inkMuted, ...rtlText }}>{context.sourceTitle}{sourceLocator(context) ? ` · ${sourceLocator(context)}` : ''}</Text> : null}
            {context.sourceUri ? <ActionButton label="افتح المصدر" onPress={() => void Linking.openURL(context.sourceUri!)} /> : null}
          </Surface>
        )) : <Text selectable style={{ color: colors.inkMuted, ...rtlText }}>مفيش مصدر محفوظ للكلمة دي.</Text>}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>المجموعات</Text>
        {detail.collections.length ? detail.collections.map((collection) => (
          <Surface key={collection.id} style={{ padding: spacing.md, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
            <Text selectable style={{ flex: 1, color: colors.ink, fontWeight: '800', ...rtlText }}>{collection.name}</Text>
            <ActionButton label="شيلها" tone="danger" onPress={() => void new CatalogRepository(asSqlDatabase(sqlite)).removeFromCollection(detail.cardId, collection.id).then(reload)} />
          </Surface>
        )) : <Text selectable style={{ color: colors.inkMuted, ...rtlText }}>الكلمة دي مش في مجموعة دلوقتي.</Text>}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>تاريخ المراجعة</Text>
        {detail.reviews.length ? detail.reviews.slice(0, 30).map((review) => (
          <View key={review.id} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.xs }}>
            <Text selectable style={{ color: review.grade === 'KNEW' ? colors.success : colors.danger, fontWeight: '900', ...rtlText }}>{review.grade === 'KNEW' ? 'عرفتها' : 'نسيتها'}</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>{new Date(review.reviewedAt).toLocaleString('ar-EG')}</Text>
          </View>
        )) : <Text selectable style={{ color: colors.inkMuted, ...rtlText }}>لسه مفيش مراجعات للكلمة دي.</Text>}
      </View>
    </ScrollView>
  );
}
