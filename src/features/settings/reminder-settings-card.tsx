import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Surface } from '@/components/primitives';
import {
  loadReviewReminderPreferences,
  setReviewReminderTime,
  setReviewRemindersEnabled,
} from '@/notifications/review-reminders';
import { colors, radius, spacing } from '@/theme/tokens';

export function ReminderSettingsCard({ languagePairId }: { languagePairId: string }) {
  const sqlite = useSQLiteContext();
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState('19:00');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadReviewReminderPreferences(sqlite, languagePairId).then((value) => {
      if (cancelled) return;
      setEnabled(value.enabled);
      setTime(value.time);
    });
    return () => { cancelled = true; };
  }, [languagePairId, sqlite]);

  async function toggle(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const next = await setReviewRemindersEnabled(sqlite, languagePairId, !enabled);
      setEnabled(next);
      setMessage(next ? 'Reminder enabled. It will only be scheduled when review material is due.' : enabled ? 'Reminder disabled.' : 'Notifications permission was not granted.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not update reminders.');
    } finally {
      setBusy(false);
    }
  }

  async function saveTime(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await setReviewReminderTime(sqlite, languagePairId, time);
      setMessage(`Reminder window saved for ${time}.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not save reminder time.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface style={{ padding: spacing.md, gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Due review reminder</Text>
        <Text selectable style={{ color: colors.inkMuted, lineHeight: 22 }}>Opt in to one quiet local reminder when scheduled vocabulary is due. No due cards means no notification.</Text>
      </View>
      <ActionButton label={busy ? 'Please wait…' : enabled ? 'Disable reminder' : 'Enable reminder'} disabled={busy} onPress={() => void toggle()} />
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={{ color: colors.ink, fontWeight: '700' }}>Preferred time (24-hour)</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TextInput accessibilityLabel="Review reminder time" value={time} onChangeText={setTime} placeholder="19:00" keyboardType="numbers-and-punctuation" maxLength={5} style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface, color: colors.ink }} />
          <View style={{ minWidth: 110 }}><ActionButton label="Save time" disabled={busy} onPress={() => void saveTime()} /></View>
        </View>
      </View>
      {message ? <Text accessibilityLiveRegion="polite" selectable style={{ color: colors.inkMuted, lineHeight: 21 }}>{message}</Text> : null}
    </Surface>
  );
}
