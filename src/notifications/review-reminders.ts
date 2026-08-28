import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import { asSqlDatabase } from '@/data/database';
import { PreferencesRepository } from '@/data/preferences';
import { isValidReminderTime, nextReminderDate } from './reminder-time';

export { isValidReminderTime, nextReminderDate } from './reminder-time';

const CHANNEL_ID = 'due-reviews';
const DEFAULT_TIME = '19:00';

export interface ReviewReminderPreferences {
  enabled: boolean;
  time: string;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function enabledKey(languagePairId: string): string {
  return `review_reminder_enabled:${languagePairId}`;
}
function timeKey(languagePairId: string): string {
  return `review_reminder_time:${languagePairId}`;
}
function notificationKey(languagePairId: string): string {
  return `review_reminder_notification:${languagePairId}`;
}

export async function loadReviewReminderPreferences(
  sqlite: SQLiteDatabase,
  languagePairId: string,
): Promise<ReviewReminderPreferences> {
  const repo = new PreferencesRepository(asSqlDatabase(sqlite));
  const [enabled, time] = await Promise.all([
    repo.get(enabledKey(languagePairId)),
    repo.get(timeKey(languagePairId)),
  ]);
  return { enabled: enabled === 'true', time: time && isValidReminderTime(time) ? time : DEFAULT_TIME };
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Due vocabulary reviews',
    description: 'Quiet reminders when vocabulary is due for review.',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function cancelStoredReminder(sqlite: SQLiteDatabase, languagePairId: string): Promise<void> {
  const repo = new PreferencesRepository(asSqlDatabase(sqlite));
  const identifier = await repo.get(notificationKey(languagePairId));
  if (identifier) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } finally {
      await repo.set(notificationKey(languagePairId), '');
    }
  }
}

async function countDueBy(
  sqlite: SQLiteDatabase,
  languagePairId: string,
  dueBy: Date,
): Promise<number> {
  const row = await sqlite.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) count
     FROM user_card_states u
     JOIN cards c ON c.id=u.card_id
     JOIN senses s ON s.id=c.sense_id
     JOIN terms t ON t.id=s.term_id
     WHERE t.language_pair_id=? AND c.deleted_at IS NULL AND s.deleted_at IS NULL AND t.deleted_at IS NULL
       AND u.next_due_at IS NOT NULL AND u.next_due_at<=?`,
    languagePairId,
    dueBy.toISOString(),
  );
  return Number(row?.count ?? 0);
}

export async function reconcileReviewReminder(
  sqlite: SQLiteDatabase,
  languagePairId: string,
  now = new Date(),
): Promise<string | null> {
  const preferences = await loadReviewReminderPreferences(sqlite, languagePairId);
  await cancelStoredReminder(sqlite, languagePairId);
  if (!preferences.enabled) return null;

  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) return null;

  const triggerAt = nextReminderDate(preferences.time, now);
  const dueCount = await countDueBy(sqlite, languagePairId, triggerAt);
  if (dueCount === 0) return null;

  await ensureAndroidChannel();
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Vocabulary review is ready',
      body: `${dueCount} ${dueCount === 1 ? 'card is' : 'cards are'} due. A short review now will protect your retention.`,
      data: { route: '/', languagePairId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerAt,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });
  await new PreferencesRepository(asSqlDatabase(sqlite)).set(notificationKey(languagePairId), identifier);
  return identifier;
}

export async function setReviewRemindersEnabled(
  sqlite: SQLiteDatabase,
  languagePairId: string,
  enabled: boolean,
): Promise<boolean> {
  const repo = new PreferencesRepository(asSqlDatabase(sqlite));
  if (enabled) {
    await ensureAndroidChannel();
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      await repo.set(enabledKey(languagePairId), 'false');
      await cancelStoredReminder(sqlite, languagePairId);
      return false;
    }
  }
  await repo.set(enabledKey(languagePairId), enabled ? 'true' : 'false');
  await reconcileReviewReminder(sqlite, languagePairId);
  return enabled;
}

export async function setReviewReminderTime(
  sqlite: SQLiteDatabase,
  languagePairId: string,
  time: string,
): Promise<void> {
  const clean = time.trim();
  if (!isValidReminderTime(clean)) throw new Error('Use a 24-hour time such as 19:00.');
  await new PreferencesRepository(asSqlDatabase(sqlite)).set(timeKey(languagePairId), clean);
  await reconcileReviewReminder(sqlite, languagePairId);
}
