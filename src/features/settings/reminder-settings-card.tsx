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

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

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
      setMessage(next ? 'تمام، هنفكرك بس لما يبقى عندك كلمات محتاجة مراجعة.' : enabled ? 'قفلنا تذكير المراجعة.' : 'محتاج تسمح بالإشعارات الأول عشان التذكير يشتغل.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'مقدرناش نغيّر إعدادات التذكير.');
    } finally {
      setBusy(false);
    }
  }

  async function saveTime(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await setReviewReminderTime(sqlite, languagePairId, time);
      setMessage(`تمام، حفظنا وقت التذكير حوالي ${time}.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'مقدرناش نحفظ وقت التذكير.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface style={{ padding: spacing.md, gap: spacing.md }}>
      <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>فكّرني بالمراجعة</Text>
        <Text selectable style={{ color: colors.inkMuted, lineHeight: 22, ...rtlText }}>تذكير واحد هادي لما يبقى عندك كلمات معاد مراجعتها. لو مفيش حاجة مستحقة، مش هنبعت إشعار.</Text>
      </View>
      <ActionButton label={busy ? 'ثانية واحدة…' : enabled ? 'اقفل التذكير' : 'فعّل التذكير'} disabled={busy} onPress={() => void toggle()} />
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={{ color: colors.ink, fontWeight: '800', ...rtlText }}>تحب نفكرك إمتى؟</Text>
        <View style={{ flexDirection: 'row-reverse', gap: spacing.sm }}>
          <TextInput accessibilityLabel="وقت تذكير المراجعة" value={time} onChangeText={setTime} placeholder="19:00" keyboardType="numbers-and-punctuation" maxLength={5} style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface, color: colors.ink, textAlign: 'center' }} />
          <View style={{ minWidth: 110 }}><ActionButton label="احفظ الوقت" disabled={busy} onPress={() => void saveTime()} /></View>
        </View>
      </View>
      {message ? <Text accessibilityLiveRegion="polite" selectable style={{ color: colors.inkMuted, lineHeight: 21, ...rtlText }}>{message}</Text> : null}
    </Surface>
  );
}
