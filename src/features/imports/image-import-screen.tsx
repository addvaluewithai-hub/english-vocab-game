import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, EmptyState, Surface } from '@/components/primitives';
import { useActiveLanguagePair } from '@/data/use-active-language-pair';
import { ImportStagingService, type ProposedVocabulary } from '@/imports/staging';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const MAX_IMAGES = 3;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

type SelectedImage = {
  uri: string;
  base64: string;
  fileName: string | null;
  fileSize: number | null;
};

type ApiCandidate = {
  term: string;
  translation: string;
  definition: string;
  contextSentence: string;
  partOfSpeech: string;
  usefulnessScore: number;
  confidenceScore: number;
};

function apiUrl(path: string): string {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  return base ? `${base.replace(/\/$/, '')}${path}` : path;
}

function isApiCandidate(value: unknown): value is ApiCandidate {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.term === 'string'
    && typeof item.translation === 'string'
    && typeof item.definition === 'string'
    && typeof item.contextSentence === 'string'
    && typeof item.partOfSpeech === 'string'
    && typeof item.usefulnessScore === 'number'
    && typeof item.confidenceScore === 'number';
}

function toSelectedImages(assets: ImagePicker.ImagePickerAsset[]): SelectedImage[] {
  return assets.slice(0, MAX_IMAGES).flatMap((asset) => {
    if (!asset.base64) return [];
    return [{
      uri: asset.uri,
      base64: asset.base64,
      fileName: asset.fileName ?? null,
      fileSize: asset.fileSize ?? null,
    }];
  });
}

export function ImageImportScreen() {
  const router = useRouter();
  const sqlite = useSQLiteContext();
  const { loading: pairLoading, pair } = useActiveLanguagePair();
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function acceptImages(next: SelectedImage[]) {
    const tooLarge = next.find((item) => item.fileSize !== null && item.fileSize > MAX_FILE_BYTES);
    if (tooLarge) {
      setError(`${tooLarge.fileName ?? 'One image'} is larger than 8 MB. Use a tighter screenshot or crop.`);
      return;
    }
    if (!next.length) {
      setError('Could not read that image. Try JPG, PNG, or a screenshot.');
      return;
    }
    setImages(next);
    setError(null);
  }

  async function chooseImages() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
      base64: true,
      quality: 0.72,
    });
    if (!result.canceled) acceptImages(toSelectedImages(result.assets));
  }

  async function takePhoto() {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission', 'Allow camera access to photograph vocabulary. You can still choose an existing image.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.72,
      cameraType: ImagePicker.CameraType.back,
    });
    if (!result.canceled) acceptImages(toSelectedImages(result.assets));
  }

  async function analyze() {
    if (!pair || !images.length || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const response = await fetch(apiUrl('/api/image-vocab'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: images.map((item) => `data:image/jpeg;base64,${item.base64}`),
          targetLanguage: pair.targetLanguageName,
          referenceLanguage: pair.referenceLanguageName,
        }),
      });
      const body = await response.json() as unknown;
      if (!response.ok) {
        const message = body && typeof body === 'object' && typeof (body as Record<string, unknown>).message === 'string'
          ? String((body as Record<string, unknown>).message)
          : 'The AI could not analyze the image.';
        throw new Error(message);
      }
      const raw = body && typeof body === 'object' ? (body as Record<string, unknown>).candidates : null;
      const candidates: ProposedVocabulary[] = Array.isArray(raw)
        ? raw.filter(isApiCandidate).map((item) => ({
            term: item.term,
            translation: item.translation,
            definition: item.definition,
            contextSentence: item.contextSentence,
            partOfSpeech: item.partOfSpeech,
            usefulnessScore: item.usefulnessScore,
            confidenceScore: item.confidenceScore,
          }))
        : [];
      if (!candidates.length) throw new Error('No clear English vocabulary was found. Try a sharper or tighter image.');

      const label = images.length === 1
        ? `Photo · ${images[0]?.fileName ?? 'vocabulary image'}`
        : `Photos · ${images.length} vocabulary images`;
      await new ImportStagingService(sqlite).createBatch(pair.id, 'PHOTO', label, candidates);
      router.replace('/import-staging');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not analyze the image.');
    } finally {
      setAnalyzing(false);
    }
  }

  if (pairLoading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator accessibilityLabel="Preparing image import" /></View>;
  }
  if (!pair) {
    return <EmptyState title="Preparing English" body="English → Arabic is set up automatically. Reopen image import if initialization was interrupted." />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ width: '100%', maxWidth: 680, alignSelf: 'center', padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }}
      style={{ flex: 1, backgroundColor: colors.canvas }}
    >
      <Surface style={{ padding: spacing.lg, gap: spacing.md, backgroundColor: colors.ink }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.small, fontWeight: '900', letterSpacing: 1 }}>AI PHOTO IMPORT</Text>
            <Text accessibilityRole="header" selectable style={{ color: colors.surface, fontSize: 30, lineHeight: 35, fontWeight: '900' }}>Turn a photo into vocab</Text>
            <Text selectable style={{ color: colors.surfaceMuted, fontSize: typography.label, lineHeight: 21 }}>
              Pick up to three images. AI finds useful English words and phrases, translates them to Arabic, and creates a natural example sentence.
            </Text>
          </View>
          <Text aria-hidden style={{ fontSize: 42 }}>📸</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Chip>EN → AR</Chip>
          <Chip>AI review first</Chip>
        </View>
      </Surface>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}><ActionButton label="Choose images" onPress={() => void chooseImages()} /></View>
        <View style={{ flex: 1 }}><ActionButton label="Take photo" onPress={() => void takePhoto()} /></View>
      </View>

      {error ? (
        <Surface style={{ padding: spacing.md, backgroundColor: colors.dangerSurface }}>
          <Text accessibilityLiveRegion="polite" selectable style={{ color: colors.danger, lineHeight: 21 }}>{error}</Text>
        </Surface>
      ) : null}

      {images.length ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text selectable style={{ flex: 1, color: colors.ink, fontSize: typography.body, fontWeight: '900' }}>Selected images</Text>
            <Chip>{images.length} / {MAX_IMAGES}</Chip>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {images.map((item, index) => (
              <Surface key={`${item.uri}-${index}`} style={{ width: 180, overflow: 'hidden' }}>
                <Image source={item.uri} style={{ width: 180, height: 150 }} contentFit="cover" />
                <View style={{ padding: spacing.sm, gap: 3 }}>
                  <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: typography.small, fontWeight: '800' }}>{item.fileName ?? `Image ${index + 1}`}</Text>
                  <Pressable accessibilityRole="button" onPress={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    <Text selectable style={{ color: colors.danger, fontSize: typography.small, fontWeight: '800' }}>Remove</Text>
                  </Pressable>
                </View>
              </Surface>
            ))}
          </ScrollView>

          <Surface style={{ padding: spacing.md, gap: spacing.xs, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg }}>
            <Text selectable style={{ color: colors.ink, fontSize: typography.label, fontWeight: '900' }}>What happens next?</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 19 }}>
              AI extracts only vocabulary it can see, creates Arabic meanings + English examples, then opens Review. Nothing enters your Bank until you approve it.
            </Text>
          </Surface>

          <ActionButton label={analyzing ? 'Reading image with AI…' : 'Analyze & review vocabulary'} disabled={analyzing || !images.length} onPress={() => void analyze()} />
          {analyzing ? <ActivityIndicator accessibilityLabel="AI is analyzing vocabulary images" /> : null}
        </View>
      ) : (
        <Surface style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
          <Text aria-hidden style={{ fontSize: 46 }}>🖼️</Text>
          <Text selectable style={{ color: colors.ink, fontSize: typography.body, fontWeight: '900', textAlign: 'center' }}>Screenshot, textbook page, menu, sign…</Text>
          <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 20, textAlign: 'center' }}>Clear, tightly cropped images give the best vocabulary extraction.</Text>
        </Surface>
      )}
    </ScrollView>
  );
}
