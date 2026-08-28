import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getNeonJwtToken } from '@/auth/neon-auth';
import { ActionButton, Surface } from '@/components/primitives';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { HttpImportJobTransport } from '@/imports/http-transport';
import { ImportJobRepository, ImportJobService } from '@/imports/jobs';
import { normalizeYouTubeUrl } from '@/imports/youtube';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function YouTubeImportScreen() {
  const sqlite = useSQLiteContext();
  const { loading, pair, ownerKey } = useActiveLanguagePair();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startImport(): Promise<void> {
    if (!pair) return;
    if (ownerKey === 'guest') {
      setMessage('Sign in before importing YouTube videos so the server job can be tied to your account.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const source = normalizeYouTubeUrl(url);
      const repository = new ImportJobRepository(sqlite);
      const job = await repository.createOrReuse({
        languagePairId: pair.id,
        sourceType: 'YOUTUBE',
        sourceFingerprint: source.fingerprint,
        sourceLabel: `YouTube ${source.videoId}`,
      });
      if (job.status === 'COMPLETED' || job.status === 'NEEDS_REVIEW' || job.status === 'PROCESSING') {
        router.replace('/imports');
        return;
      }
      const service = new ImportJobService(sqlite, new HttpImportJobTransport(getNeonJwtToken));
      await service.submit(job.id, { url: source.canonicalUrl });
      router.replace('/imports');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not import this YouTube video.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator accessibilityLabel="Loading language pair" />
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      style={{ flex: 1, backgroundColor: colors.canvas }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>
          Import from YouTube
        </Text>
        <Text style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25 }}>
          Paste a public YouTube video URL. The importer analyzes the video server-side and proposes a small vocabulary set with timestamped context.
        </Text>
      </View>

      <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text style={{ color: colors.ink, fontWeight: '700' }}>YouTube URL</Text>
        <TextInput
          accessibilityLabel="YouTube video URL"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://www.youtube.com/watch?v=…"
          placeholderTextColor={colors.inkMuted}
          value={url}
          onChangeText={setUrl}
          style={{
            minHeight: 52,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            color: colors.ink,
            backgroundColor: colors.surface,
            fontSize: typography.body,
          }}
        />
        <Text style={{ color: colors.inkMuted, lineHeight: 22 }}>
          Public videos only. Private, unlisted, unavailable, or unsupported videos fail explicitly and never add vocabulary automatically.
        </Text>
        <ActionButton label={busy ? 'Analyzing video…' : 'Analyze video'} disabled={busy || !pair} onPress={() => void startImport()} />
      </Surface>

      {message ? (
        <Surface style={{ padding: spacing.md }}>
          <Text accessibilityLiveRegion="polite" style={{ color: colors.inkMuted, lineHeight: 22 }}>{message}</Text>
        </Surface>
      ) : null}
    </ScrollView>
  );
}
