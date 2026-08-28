import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { asSqlDatabase } from '@/data/database';
import { PreferencesRepository } from '@/data/preferences';
import { setActiveStudySession } from '@/study/session-store';
import { reconcileReviewReminder } from './review-reminders';

function pairIdFromResponse(response: Notifications.NotificationResponse): string | null {
  const value = response.notification.request.content.data?.languagePairId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function ReminderCoordinator() {
  const sqlite = useSQLiteContext();
  const router = useRouter();

  useEffect(() => {
    let disposed = false;
    const preferences = new PreferencesRepository(asSqlDatabase(sqlite));

    async function reconcileActivePair(): Promise<void> {
      const current = await preferences.load();
      if (!current.activeLanguagePairId) return;
      await reconcileReviewReminder(sqlite, current.activeLanguagePairId);
    }

    async function openResponse(response: Notifications.NotificationResponse): Promise<void> {
      const languagePairId = pairIdFromResponse(response);
      if (!languagePairId || disposed) return;
      await preferences.set('active_language_pair_id', languagePairId);
      setActiveStudySession(null);
      router.replace('/');
      await Notifications.clearLastNotificationResponseAsync();
    }

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) void openResponse(response);
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void openResponse(response);
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reconcileActivePair();
    });
    void reconcileActivePair();

    return () => {
      disposed = true;
      responseSubscription.remove();
      appStateSubscription.remove();
    };
  }, [router, sqlite]);

  return null;
}
