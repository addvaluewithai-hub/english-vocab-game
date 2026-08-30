import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import type { SourceType } from '@/domain/types';
import { discoverVocabulary, enrichDiscoveredVocabulary, type DiscoveredVocabulary, type GeminiImportSourceType } from '@/ai/import-pipeline';
import { ImportStagingService } from '@/imports/staging';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_PDF_BYTES = 8 * 1024 * 1024;

const SOURCES: { type: GeminiImportSourceType; icon: string; label: string; hint: string }[] = [
  { type: 'TEXT', icon: '✍️', label: 'Text', hint: 'Paste notes, a list, or a paragraph' },
  { type: 'PHOTO', icon: '🖼️', label: 'Images', hint: 'Camera or up to 3 screenshots/photos' },
  { type: 'PDF', icon: '📄', label: 'PDF', hint: 'Let Gemini read the document' },
  { type: 'YOUTUBE', icon: '▶️', label: 'YouTube', hint: 'Public video URL' },
  { type: 'URL', icon: '🌐', label: 'Web URL', hint: 'Public article, page, or linked PDF' },
];

type SelectedImage = {
  uri: string;
  data: string;
  mimeType: string;
  name: string;
  size: number | null;
};

type SelectedPdf = {
  name: string;
  data: string;
  size: number | null;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return globalThis.btoa(binary);
}

async function pdfAssetToBase64(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (asset.base64) return asset.base64;
  if (asset.file) return arrayBufferToBase64(await asset.file.arrayBuffer());
  return FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
}

function selectedImageFromAsset(asset: ImagePicker.ImagePickerAsset, fallbackName: string): SelectedImage | null {
  if (!asset.base64) return null;
  return {
    uri: asset.uri,
    data: asset.base64,
    mimeType: asset.mimeType ?? 'image/jpeg',
    name: asset.fileName ?? fallbackName,
    size: asset.fileSize ?? null,
  };
}

function sourceTitle(
  type: GeminiImportSourceType,
  text: string,
  youtubeUrl: string,
  webUrl: string,
  pdf: SelectedPdf | null,
  images: SelectedImage[],
): string {
  if (type === 'TEXT') return `Text · ${text.trim().slice(0, 48) || 'pasted vocabulary'}`;
  if (type === 'PDF') return `PDF · ${pdf?.name ?? 'document'}`;
  if (type === 'YOUTUBE') return `YouTube · ${youtubeUrl.trim().slice(0, 72)}`;
  if (type === 'URL') return `Web · ${webUrl.trim().slice(0, 72)}`;
  return images.length === 1 ? `Photo · ${images[0]?.name ?? 'image'}` : `Photos · ${images.length} images`;
}

function sourceTypeForBatch(type: GeminiImportSourceType): SourceType {
  return type;
}

export function SmartImportScreen({ initialSourceType = 'TEXT' }: { initialSourceType?: GeminiImportSourceType }) {
  const router = useRouter();
  const sqlite = useSQLiteContext();
  const { loading: pairLoading, pair } = useActiveLanguagePair();
  const [sourceType, setSourceType] = useState<GeminiImportSourceType>(initialSourceType);
  const [text, setText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [pdf, setPdf] = useState<SelectedPdf | null>(null);
  const [candidates, setCandidates] = useState<DiscoveredVocabulary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [discovering, setDiscovering] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCandidates = useMemo(
    () => candidates.filter((item) => selected.has(item.term.toLocaleLowerCase())),
    [candidates, selected],
  );

  function resetDiscovery() {
    setCandidates([]);
    setSelected(new Set());
  }

  function changeSource(next: GeminiImportSourceType) {
    setSourceType(next);
    resetDiscovery();
    setError(null);
  }

  function validateImageSize(item: SelectedImage): boolean {
    if (item.size !== null && item.size > MAX_IMAGE_BYTES) {
      setError(`${item.name} is larger than 3 MB. Crop it or choose a smaller image.`);
      return false;
    }
    return true;
  }

  async function chooseImages() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
      base64: true,
      quality: 0.7,
    });
    if (result.canceled) return;
    const next = result.assets
      .slice(0, MAX_IMAGES)
      .flatMap((asset, index) => {
        const item = selectedImageFromAsset(asset, `Image ${index + 1}`);
        return item ? [item] : [];
      });
    const tooLarge = next.find((item) => item.size !== null && item.size > MAX_IMAGE_BYTES);
    if (tooLarge) {
      setError(`${tooLarge.name} is larger than 3 MB. Crop it or choose a smaller image.`);
      return;
    }
    setImages(next);
    resetDiscovery();
    setError(next.length ? null : 'Could not read those images.');
  }

  async function takePhoto() {
    if (images.length >= MAX_IMAGES) {
      setError(`You already have ${MAX_IMAGES} images. Remove/reselect before taking another photo.`);
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera permission is required to take a vocabulary photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    const item = selectedImageFromAsset(result.assets[0], `Camera ${images.length + 1}`);
    if (!item) {
      setError('Could not read that photo.');
      return;
    }
    if (!validateImageSize(item)) return;
    setImages((current) => [...current, item].slice(0, MAX_IMAGES));
    resetDiscovery();
    setError(null);
  }

  async function choosePdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      multiple: false,
      copyToCacheDirectory: true,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size !== undefined && asset.size > MAX_PDF_BYTES) {
      setError('Use a PDF smaller than 8 MB for the quick import path.');
      return;
    }
    setError(null);
    try {
      const data = await pdfAssetToBase64(asset);
      setPdf({ name: asset.name, data, size: asset.size ?? null });
      resetDiscovery();
    } catch {
      setError('Could not read that PDF. Try downloading it locally first.');
    }
  }

  async function discover() {
    if (!pair || discovering) return;
    setDiscovering(true);
    setError(null);
    try {
      let next: DiscoveredVocabulary[];
      if (sourceType === 'TEXT') {
        if (!text.trim()) throw new Error('Paste some English text first.');
        next = await discoverVocabulary({ sourceType, text: text.trim() });
      } else if (sourceType === 'PHOTO') {
        if (!images.length) throw new Error('Choose or take at least one image first.');
        next = await discoverVocabulary({
          sourceType,
          images: images.map(({ mimeType, data }) => ({ mimeType, data })),
        });
      } else if (sourceType === 'PDF') {
        if (!pdf) throw new Error('Choose a PDF first.');
        next = await discoverVocabulary({ sourceType, file: { name: pdf.name, data: pdf.data } });
      } else if (sourceType === 'YOUTUBE') {
        if (!youtubeUrl.trim()) throw new Error('Paste a public YouTube URL first.');
        next = await discoverVocabulary({ sourceType, url: youtubeUrl.trim() });
      } else {
        if (!webUrl.trim()) throw new Error('Paste a public web URL first.');
        next = await discoverVocabulary({ sourceType, url: webUrl.trim() });
      }
      setCandidates(next);
      setSelected(new Set(next.filter((item) => item.usefulnessScore >= 0.6).map((item) => item.term.toLocaleLowerCase())));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gemini could not analyze this source.');
    } finally {
      setDiscovering(false);
    }
  }

  async function prepareSelected() {
    if (!pair || !selectedCandidates.length || enriching) return;
    setEnriching(true);
    setError(null);
    try {
      const enriched = await enrichDiscoveredVocabulary(selectedCandidates);
      await new ImportStagingService(sqlite).createBatch(
        pair.id,
        sourceTypeForBatch(sourceType),
        sourceTitle(sourceType, text, youtubeUrl, webUrl, pdf, images),
        enriched,
      );
      router.replace('/import-staging');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not prepare the selected vocabulary.');
    } finally {
      setEnriching(false);
    }
  }

  if (pairLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator /></View>;
  if (!pair) return <EmptyState title="Preparing English" body="English → Arabic is created automatically on first launch." />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.lg, gap: spacing.md, paddingBottom: 100 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Surface style={{ padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.ink }}>
        <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.small, fontWeight: '900', letterSpacing: 1 }}>GEMINI SMART IMPORT</Text>
        <Text accessibilityRole="header" selectable style={{ color: colors.surface, fontSize: 30, lineHeight: 35, fontWeight: '900' }}>Bring your own English</Text>
        <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.label, lineHeight: 21 }}>Gemini finds useful vocabulary first. You choose what matters. Only then do we translate it and create examples.</Text>
      </Surface>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {SOURCES.map((source) => {
          const active = source.type === sourceType;
          return (
            <Pressable key={source.type} accessibilityRole="button" onPress={() => changeSource(source.type)} style={{ width: 150, padding: spacing.md, gap: 4, borderRadius: radius.lg, borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.surfaceMuted : colors.surface }}>
              <Text aria-hidden style={{ fontSize: 26 }}>{source.icon}</Text>
              <Text style={{ color: colors.ink, fontWeight: '900' }}>{source.label}</Text>
              <Text style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 18 }}>{source.hint}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {sourceType === 'TEXT' ? (
        <TextInput accessibilityLabel="Text to analyze" value={text} onChangeText={(value) => { setText(value); resetDiscovery(); }} placeholder="Paste a list, notes, subtitles, an article excerpt…" placeholderTextColor={colors.inkMuted} multiline style={{ minHeight: 180, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.md, color: colors.ink, textAlignVertical: 'top', fontSize: typography.body }} />
      ) : null}

      {sourceType === 'YOUTUBE' ? (
        <TextInput accessibilityLabel="YouTube URL" value={youtubeUrl} onChangeText={(value) => { setYoutubeUrl(value); resetDiscovery(); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://www.youtube.com/watch?v=…" placeholderTextColor={colors.inkMuted} style={{ minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.ink }} />
      ) : null}

      {sourceType === 'URL' ? (
        <View style={{ gap: spacing.sm }}>
          <TextInput accessibilityLabel="Public web URL" value={webUrl} onChangeText={(value) => { setWebUrl(value); resetDiscovery(); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://example.com/article" placeholderTextColor={colors.inkMuted} style={{ minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.ink }} />
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 19 }}>Works with public pages and direct public PDF/image URLs. Login-required and paywalled pages cannot be read by Gemini URL Context.</Text>
        </View>
      ) : null}

      {sourceType === 'PDF' ? (
        <View style={{ gap: spacing.sm }}>
          <ActionButton label={pdf ? 'Choose another PDF' : 'Choose PDF'} onPress={() => void choosePdf()} />
          {pdf ? <Surface style={{ padding: spacing.md, gap: 3 }}><Text selectable style={{ color: colors.ink, fontWeight: '900' }}>{pdf.name}</Text><Text style={{ color: colors.inkMuted, fontSize: typography.small }}>{pdf.size ? `${(pdf.size / 1024 / 1024).toFixed(1)} MB` : 'Ready to analyze'}</Text></Surface> : null}
        </View>
      ) : null}

      {sourceType === 'PHOTO' ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}><ActionButton label={images.length ? 'Choose other images' : 'Choose images'} onPress={() => void chooseImages()} /></View>
            <View style={{ flex: 1 }}><ActionButton label="Take photo" onPress={() => void takePhoto()} /></View>
          </View>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 19 }}>Up to 3 images total. Gemini reads visible English across all of them together.</Text>
          {images.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>{images.map((item) => <Surface key={item.uri} style={{ width: 150, overflow: 'hidden' }}><Image source={item.uri} style={{ width: 150, height: 112 }} contentFit="cover" /><View style={{ padding: spacing.sm }}><Text numberOfLines={1} style={{ color: colors.ink, fontSize: typography.small, fontWeight: '800' }}>{item.name}</Text></View></Surface>)}</ScrollView> : null}
        </View>
      ) : null}

      {error ? <Surface style={{ padding: spacing.md, backgroundColor: colors.dangerSurface }}><Text accessibilityLiveRegion="polite" selectable style={{ color: colors.danger }}>{error}</Text></Surface> : null}

      {!candidates.length ? (
        <View style={{ gap: spacing.sm }}>
          <ActionButton label={discovering ? 'Gemini is finding vocabulary…' : 'Find useful vocabulary'} disabled={discovering} onPress={() => void discover()} />
          {discovering ? <ActivityIndicator accessibilityLabel="Gemini is analyzing the source" /> : null}
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 19, textAlign: 'center' }}>First pass only discovers candidates. No translation tokens are spent on words you do not choose.</Text>
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}><Text selectable style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>Choose your words</Text><Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>{selectedCandidates.length} of {candidates.length} selected</Text></View>
            <Pressable onPress={() => setSelected(new Set(candidates.map((item) => item.term.toLocaleLowerCase())))}><Text style={{ color: colors.accent, fontWeight: '800' }}>All</Text></Pressable>
            <Pressable onPress={() => setSelected(new Set())}><Text style={{ color: colors.inkMuted, fontWeight: '800' }}>Clear</Text></Pressable>
          </View>

          {candidates.map((candidate) => {
            const key = candidate.term.toLocaleLowerCase();
            const checked = selected.has(key);
            return (
              <Pressable key={key} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => setSelected((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; })}>
                <Surface style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, opacity: checked ? 1 : 0.62 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: checked ? colors.accent : colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: checked ? colors.accent : colors.surface }}><Text style={{ color: colors.surface, fontWeight: '900' }}>{checked ? '✓' : ''}</Text></View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>{candidate.term}</Text>
                    {candidate.contextHint ? <Text selectable numberOfLines={2} style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 18 }}>{candidate.contextHint}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}><Chip>{candidate.kind === 'WORD' ? 'Word' : 'Phrase'}</Chip><Text style={{ color: colors.inkMuted, fontSize: 11 }}>{Math.round(candidate.usefulnessScore * 100)}% useful</Text></View>
                </Surface>
              </Pressable>
            );
          })}

          <Surface style={{ padding: spacing.md, gap: spacing.xs, backgroundColor: colors.surfaceMuted }}><Text selectable style={{ color: colors.ink, fontWeight: '900' }}>Next step</Text><Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 19 }}>Gemini translates only the selected items and creates a definition + natural example + Arabic example translation. Then you get one final editable Review screen.</Text></Surface>
          <ActionButton label={enriching ? `Preparing ${selectedCandidates.length}…` : `Translate & review ${selectedCandidates.length}`} disabled={enriching || selectedCandidates.length === 0} onPress={() => void prepareSelected()} />
          {enriching ? <ActivityIndicator accessibilityLabel="Gemini is enriching selected vocabulary" /> : null}
          <Pressable onPress={resetDiscovery}><Text style={{ color: colors.inkMuted, fontWeight: '800', textAlign: 'center' }}>Analyze a different source</Text></Pressable>
        </View>
      )}
    </ScrollView>
  );
}
