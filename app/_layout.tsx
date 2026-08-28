import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeDatabase } from '@/data/initialize';
import { ReminderCoordinator } from '@/notifications/reminder-coordinator';
import { SyncCoordinator } from '@/sync/coordinator';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="vocab-flow.db" onInit={initializeDatabase}>
        <SyncCoordinator />
        <ReminderCoordinator />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.canvas },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.canvas },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Study' }} />
          <Stack.Screen name="bank" options={{ title: 'Vocabulary Bank' }} />
          <Stack.Screen name="add" options={{ title: 'Vocabulary', presentation: 'modal' }} />
          <Stack.Screen name="vocabulary/[cardId]" options={{ title: 'Vocabulary' }} />
          <Stack.Screen name="collections" options={{ title: 'Collections' }} />
          <Stack.Screen name="import-staging" options={{ title: 'Review Import' }} />
          <Stack.Screen name="auth" options={{ title: 'Account', presentation: 'modal' }} />
          <Stack.Screen name="stats" options={{ title: 'Stats' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
