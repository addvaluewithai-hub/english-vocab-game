import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { cachedPronunciationAudioUri, resolvePronunciationAudioUri } from '@/audio/pronunciation-cache';
import { ActionButton } from './primitives';
import { colors, spacing, typography } from '@/theme/tokens';

export function PronunciationButton({
  uri,
  pronunciation,
  compact = false,
}: {
  uri: string | null;
  pronunciation?: string | null;
  compact?: boolean;
}) {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const loadedUri = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') player.pause();
    });
    return () => subscription.remove();
  }, [player]);

  async function replay(): Promise<void> {
    if (!uri || preparing) return;
    setError(null);
    setPreparing(true);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      const source = cachedPronunciationAudioUri(uri) ?? await resolvePronunciationAudioUri(uri);
      if (loadedUri.current !== source) {
        player.replace(source);
        loadedUri.current = source;
      } else {
        await player.seekTo(0);
      }
      player.play();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'الصوت مش متاح دلوقتي.');
    } finally {
      setPreparing(false);
    }
  }

  if (!uri && !pronunciation) return null;

  const buttonLabel = preparing
    ? 'بنجهز الصوت…'
    : status.playing
      ? '↻ اسمع تاني'
      : '▶ اسمع النطق';

  return (
    <View style={{ gap: spacing.xs, alignItems: compact ? 'center' : 'flex-start' }}>
      {pronunciation ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label }}>{pronunciation}</Text> : null}
      {uri ? <ActionButton accessibilityLabel={preparing ? 'بنجهز صوت النطق' : status.playing ? 'اسمع النطق تاني' : 'اسمع النطق'} label={buttonLabel} onPress={() => void replay()} /> : null}
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, fontSize: typography.small, textAlign: 'right', writingDirection: 'rtl' }}>الصوت مش شغال دلوقتي، تقدر تكمل مذاكرة عادي.</Text> : null}
    </View>
  );
}
