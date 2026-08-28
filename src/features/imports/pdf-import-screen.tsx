import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getNeonJwtToken } from '@/auth/neon-auth';
import { ActionButton, Surface } from '@/components/primitives';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { HttpImportJobTransport } from '@/imports/http-transport';
import { ImportJobRepository, ImportJobService } from '@/imports/jobs';
import { uploadImportFile } from '@/imports/upload-client';
import { colors, spacing, typography } from '@/theme/tokens';

function pdfFingerprint(asset: DocumentPicker.DocumentPickerAsset): string {
  return `pdf:${asset.name.trim().toLocaleLowerCase()}:${asset.size ?? 0}:${asset.lastModified ?? 0}`;
}

export function PdfImportScreen() {
  const sqlite = useSQLiteContext();
  const { loading, pair, ownerKey } = useActiveLanguagePair();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function choosePdf(): Promise<void> {
    if (!pair) return;
    if (ownerKey === 'guest') {
      setMessage('Sign in before importing PDFs so the secure upload and server-side analysis can be tied to your account.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset) throw new Error('No PDF was selected.');
      const size = asset.size ?? 0;
      if (size <= 0) throw new Error('The selected PDF is empty or its size could not be read.');
      if (size > 25 * 1024 * 1024) throw new Error('PDF imports are limited to 25 MB.');

      const repository = new ImportJobRepository(sqlite);
      const job = await repository.createOrReuse({
        languagePairId: pair.id,
        sourceType: 'PDF',
        sourceFingerprint: pdfFingerprint(asset),
        sourceLabel: asset.name,
      });
      if (job.status === 'COMPLETED' || job.status === 'NEEDS_REVIEW' || job.status === 'PROCESSING') {
        router.replace('/imports');
        return;
      }

      const uploaded = await uploadImportFile({
        languagePairId: pair.id,
        localJobId: job.id,
        sourceType: 'PDF',
        fileName: asset.name,
        contentType: 'application/pdf',
        size,
        uri: asset.uri,
      });
      const service = new ImportJobService(sqlite, new HttpImportJobTransport(getNeonJwtToken));
      await service.submit(job.id, {
        objectKey: uploaded.objectKey,
        fileName: asset.name,
        contentType: 'application/pdf',
        size,
      });
      router.replace('/imports');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not start this PDF import.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="Loading language pair" /></View>;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>Import a PDF</Text>
        <Text style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25 }}>Choose a text PDF up to 25 MB. The file uploads directly to temporary private Neon storage, then the server analyzes its short-lived URL and proposes vocabulary with page provenance.</Text>
      </View>
      <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text style={{ color: colors.ink, fontWeight: '700' }}>Text PDFs first</Text>
        <Text style={{ color: colors.inkMuted, lineHeight: 22 }}>Scanned or encrypted PDFs are reported explicitly instead of silently producing weak vocabulary. The original upload is temporary and nothing enters your bank until you approve it.</Text>
        <ActionButton label={busy ? 'Analyzing PDF…' : 'Choose PDF'} disabled={busy || !pair} onPress={() => void choosePdf()} />
      </Surface>
      {message ? <Surface style={{ padding: spacing.md }}><Text accessibilityLiveRegion="polite" style={{ color: colors.inkMuted, lineHeight: 22 }}>{message}</Text></Surface> : null}
    </ScrollView>
  );
}
