import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import * as Speech from 'expo-speech';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function SpeechButton({ text, label }: { text: string; label: string }) {
  const [speaking, setSpeaking] = useState(false);

  async function speak() {
    const value = text.trim();
    if (!value) return;
    await Speech.stop();
    setSpeaking(true);
    Speech.speak(value, {
      language: 'en-US',
      rate: 0.88,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${text}`}
      onPress={(event) => {
        event.stopPropagation();
        void speak();
      }}
      style={({ pressed }) => ({
        minHeight: 42,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Text selectable style={{ color: colors.ink, fontSize: typography.label, fontWeight: '900' }}>
        {speaking ? '🔊 شغال…' : `🔊 ${label}`}
      </Text>
    </Pressable>
  );
}
