import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getNeonJwtToken } from '@/auth/neon-auth';
import { ActionButton, Chip, Surface } from '@/components/primitives';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { HttpImportJobTransport } from '@/imports/http-transport';
import { ImportJobRepository, ImportJobService } from '@/imports/jobs';
import {
  MAX_PASTED_TEXT_CHARS,
  parseExplicitVocabularyList,
  textSourceFingerprint,
  validatePastedText,
} from '@/imports/text-parser';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function TextImportScreen() {
  const sqlite = useSQLiteContext();
  const { loading, pair, ownerKey } = useActiveLanguagePair();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const listCandidates = useMemo(() => parseExplicitVocabularyList(text), [text]);
  const isList = listCandidates.length > 0;

  async function submit(): Promise<void> {
    if (!pair) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const cleanText = validatePastedText(text);
      const repository = new ImportJobRepository(sqlite);
      const job = await repository.createOrReuse({
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

      if (isList) {
        await repository.applyRemoteSnapshot(job.id, {
          serverJobId: `local:${job.id}`,
          status: 'NEEDS_REVIEW',
          candidates: listCandidates,
          artifactExpiresAt: null,
        });
        await repository.sendToStaging(job.id);
        router.push('/import-staging');
        return;
      }

      if (ownerKey === 'guest') {
        throw new Error('Sign in to use AI-assisted prose extraction. Vocabulary lists with a translation work offline without an account.');
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
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>Paste text or a word list</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25 }}>
          Import {pair.targetLanguageName} vocabulary with meanings in {pair.referenceLanguageName}. You will review every candidate before it reaches your bank.
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
        <Text style={{ color: colors.ink, fontWeight: '700' }}>Text</Text>
        <TextInput
          accessibilityLabel="Text to import"
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          maxLength={MAX_PASTED_TEXT_CHARS}
          placeholder={'Paste a paragraph, or one item per line:\nlook forward to — يتطلع إلى\nreliable — موثوق'}
          placeholderTextColor={colors.inkMuted}
          style={{ minHeight: 220, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.ink, backgroundColor: colors.canvas, fontSize: typography.body, lineHeight: 24 }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
          <Chip>{text.length.toLocaleString()} / {MAX_PASTED_TEXT_CHARS.toLocaleString()} chars</Chip>
          {isList ? <Chip>{listCandidates.length} list candidates detected</Chip> : <Chip>Prose → curated AI extraction</Chip>}
        </View>
      </Surface>

      {message ? <Surface style={{ padding: spacing.md }}><Text accessibilityLiveRegion="polite" selectable style={{ color: colors.inkMuted, lineHeight: 22 }}>{message}</Text></Surface> : null}

      <ActionButton
        label={submitting ? 'Preparing import…' : isList ? 'Review list candidates' : 'Extract useful vocabulary'}
        disabled={submitting || !text.trim()}
        onPress={() => void submit()}
      />
      <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 20 }}>
        Lists with explicit meanings are parsed locally and work offline. Prose extraction requires a signed-in account and the configured server-side AI service.
      </Text>
    </ScrollView>
  );
}
