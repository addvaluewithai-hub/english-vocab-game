import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
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
  const player = useAudioPlayer(uri, { downloadFirst: true, updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') player.pause();
    });
    return () => subscription.remove();
  }, [player]);

  async function replay(): Promise<void> {
    if (!uri) return;
    setError(null);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      await player.seekTo(0);
      player.play();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pronunciation audio is unavailable.');
    }
  }

  if (!uri && !pronunciation) return null;

  return (
    <View style={{ gap: spacing.xs, alignItems: compact ? 'center' : 'flex-start' }}>
      {pronunciation ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label }}>{pronunciation}</Text> : null}
      {uri ? <ActionButton accessibilityLabel={status.playing ? 'Replay pronunciation' : 'Play pronunciation'} label={status.playing ? '↻ Replay audio' : '▶ Pronunciation'} onPress={() => void replay()} /> : null}
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, fontSize: typography.small }}>Audio unavailable. You can keep studying.</Text> : null}
    </View>
  );
}
