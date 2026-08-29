import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getNeonJwtToken } from '@/auth/neon-auth';
import { ActionButton, Chip, Surface } from '@/components/primitives';
import { asSqlDatabase } from '@/data/database';
import { GUEST_OWNER_KEY, PreferencesRepository } from '@/data/preferences';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import type { NormalizedImportCandidate } from '@/imports/contracts';
import { HttpImportJobTransport } from '@/imports/http-transport';
import { ImportJobRepository, ImportJobService } from '@/imports/jobs';
import { DEFAULT_LEARNER_LEVEL, isLearnerLevel } from '@/imports/ranking';
import { enrichTextItemsBatch } from '@/imports/text-enrichment-client';
import {
  AI_LIST_BATCH_SIZE,
  MAX_PASTED_TEXT_CHARS,
  parseExplicitVocabularyList,
  parseLooseVocabularyList,
  textSourceFingerprint,
  type ParsedVocabularyListItem,
  validatePastedText,
} from '@/imports/text-parser';
import { colors, radius, spacing, typography } from '@/theme/tokens';

function pendingCandidate(item: ParsedVocabularyListItem): NormalizedImportCandidate {
  return {
    candidateKey: item.itemKey,
    term: item.term,
    translation: item.translation ?? '',
    definition: null,
    partOfSpeech: null,
    context: null,
    occurrence: {
      sentence: null,
      sourceUri: null,
      locator: null,
      pageNumber: null,
      timestampSeconds: null,
    },
    confidence: null,
    usefulness: null,
    cefrLevel: null,
    duplicateHint: null,
    isVisuallyConcrete: null,
  };
}

export function TextImportScreen() {
  const sqlite = useSQLiteContext();
  const { loading, pair, ownerKey } = useActiveLanguagePair();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const listItems = useMemo(() => parseLooseVocabularyList(text), [text]);
  const isList = listItems.length > 0;
  const missingMeaningCount = listItems.filter((item) => !item.translation).length;

  async function currentLearnerLevel() {
    const value = await new PreferencesRepository(asSqlDatabase(sqlite)).get('learner_level');
    return isLearnerLevel(value) ? value : DEFAULT_LEARNER_LEVEL;
  }

  async function enrichList(jobId: string, items: ParsedVocabularyListItem[]): Promise<void> {
    if (!pair) return;
    const repository = new ImportJobRepository(sqlite);
    const current = await repository.get(jobId);
    let working = current?.candidates?.length === items.length
      ? [...current.candidates]
      : items.map(pendingCandidate);

    await repository.saveLocalCandidates(jobId, working, 'PROCESSING');
    const pendingIndexes = working
      .map((candidate, index) => candidate.confidence === null ? index : -1)
      .filter((index) => index >= 0);
    setProgress({ completed: items.length - pendingIndexes.length, total: items.length });

    const learnerLevel = await currentLearnerLevel();
    for (let offset = 0; offset < pendingIndexes.length; offset += AI_LIST_BATCH_SIZE) {
      const indexes = pendingIndexes.slice(offset, offset + AI_LIST_BATCH_SIZE);
      const batchItems = indexes.map((index) => items[index]!);
      const enriched = await enrichTextItemsBatch({
        getAccessToken: getNeonJwtToken,
        languagePairId: pair.id,
        learnerLevel,
        items: batchItems,
      });
      if (enriched.length !== batchItems.length) {
        throw new Error('AI enrichment returned a partial batch. Your completed batches were saved; retry to continue.');
      }
      indexes.forEach((index, batchIndex) => {
        working[index] = enriched[batchIndex]!;
      });
      await repository.saveLocalCandidates(jobId, working, 'PROCESSING');
      setProgress({
        completed: working.filter((candidate) => candidate.confidence !== null).length,
        total: items.length,
      });
    }

    await repository.saveLocalCandidates(jobId, working, 'NEEDS_REVIEW');
    await repository.sendToStaging(jobId);
  }

  async function submit(): Promise<void> {
    if (!pair) return;
    setSubmitting(true);
    setMessage(null);
    setProgress(null);
    try {
      const cleanText = validatePastedText(text);
      const repository = new ImportJobRepository(sqlite);
      let job = await repository.createOrReuse({
        languagePairId: pair.id,
        sourceType: 'TEXT',
        sourceFingerprint: textSourceFingerprint(cleanText),
        sourceLabel: title.trim() || (isList ? 'Pasted vocabulary list' : 'Pasted text'),
      });

      if (job.status === 'COMPLETED') {
        setMessage('This exact source was already reviewed. Reusing it would create duplicate import work.');
        return;
      }
      if (job.status === 'NEEDS_REVIEW' && job.candidates?.length) {
        await repository.sendToStaging(job.id);
        router.push('/import-staging');
        return;
      }
      if (job.status === 'FAILED' || job.status === 'CANCELLED') {
        job = await repository.prepareRetry(job.id);
      }

      if (isList) {
        if (ownerKey === GUEST_OWNER_KEY) {
          if (missingMeaningCount > 0) {
            throw new Error('Sign in so AI can translate and enrich vocabulary items that are missing meanings.');
          }
          const offlineCandidates = parseExplicitVocabularyList(cleanText);
          await repository.saveLocalCandidates(job.id, offlineCandidates, 'NEEDS_REVIEW');
          await repository.sendToStaging(job.id);
          router.push('/import-staging');
          return;
        }

        try {
          await enrichList(job.id, listItems);
        } catch (caught) {
          const errorMessage = caught instanceof Error ? caught.message : 'Vocabulary enrichment failed.';
          await repository.markFailed(job.id, 'ENRICHMENT_FAILED', errorMessage);
          throw caught;
        }
        router.push('/import-staging');
        return;
      }

      if (ownerKey === GUEST_OWNER_KEY) {
        throw new Error('Sign in to use AI-assisted prose extraction.');
      }
      const service = new ImportJobService(
        sqlite,
        new HttpImportJobTransport(getNeonJwtToken),
      );
      const updated = await service.submit(job.id, { text: cleanText });
      if (updated.status !== 'NEEDS_REVIEW') throw new Error('The text importer did not return reviewable candidates.');
      router.push('/import-staging');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not prepare this import.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="Loading language pair" /></View>;
  }
  if (!pair) {
    return <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'center', backgroundColor: colors.canvas }}><Text style={{ color: colors.ink, fontSize: typography.body }}>Choose a language pair in Settings before importing vocabulary.</Text></View>;
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>Paste anything</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25 }}>
          Paste {pair.targetLanguageName} words, phrases, meanings, or normal prose. AI fills missing study data and you review everything before it reaches your bank.
        </Text>
      </View>

      <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text style={{ color: colors.ink, fontWeight: '700' }}>Source title (optional)</Text>
        <TextInput
          accessibilityLabel="Import source title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Chapter 4 notes"
          placeholderTextColor={colors.inkMuted}
          style={{ minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.canvas }}
        />
        <Text style={{ color: colors.ink, fontWeight: '700' }}>Vocabulary or text</Text>
        <TextInput
          accessibilityLabel="Text to import"
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          maxLength={MAX_PASTED_TEXT_CHARS}
          placeholder={'Any of these work:\nresilient\nlook forward to\nreliable — موثوق\n1. carry on\n\nor paste a normal paragraph.'}
          placeholderTextColor={colors.inkMuted}
          style={{ minHeight: 220, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.ink, backgroundColor: colors.canvas, fontSize: typography.body, lineHeight: 24 }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
          <Chip>{text.length.toLocaleString()} / {MAX_PASTED_TEXT_CHARS.toLocaleString()} chars</Chip>
          {isList ? <Chip>{listItems.length.toLocaleString()} vocabulary items</Chip> : <Chip>Prose → curated AI extraction</Chip>}
          {isList && missingMeaningCount > 0 ? <Chip>{missingMeaningCount.toLocaleString()} need translation</Chip> : null}
        </View>
      </Surface>

      {progress ? (
        <Surface style={{ padding: spacing.md, gap: spacing.xs }}>
          <Text accessibilityLiveRegion="polite" selectable style={{ color: colors.ink, fontWeight: '800' }}>
            Enriching {progress.completed.toLocaleString()} / {progress.total.toLocaleString()}
          </Text>
          <Text selectable style={{ color: colors.inkMuted, lineHeight: 21 }}>
            Large lists are processed in safe batches of {AI_LIST_BATCH_SIZE}. Completed batches are checkpointed on this device.
          </Text>
        </Surface>
      ) : null}

      {message ? <Surface style={{ padding: spacing.md }}><Text accessibilityLiveRegion="polite" selectable style={{ color: colors.inkMuted, lineHeight: 22 }}>{message}</Text></Surface> : null}

      <ActionButton
        label={submitting ? (progress ? `Enriching ${progress.completed}/${progress.total}…` : 'Preparing import…') : isList ? 'Enrich & review vocabulary' : 'Extract useful vocabulary'}
        disabled={submitting || !text.trim()}
        onPress={() => void submit()}
      />
      <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 20 }}>
        Signed-in lists use AI to fill translations, definitions, level, part of speech, and a natural study example. Lists that already contain meanings can still be staged offline as a guest. Up to 2,000 list items are accepted per import.
      </Text>
    </ScrollView>
  );
}
