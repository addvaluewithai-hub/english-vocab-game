import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppBottomNav } from '@/components/app-bottom-nav';
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
        <View style={{ flex: 1, backgroundColor: colors.canvas }}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.canvas },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.canvas },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Home', headerShown: false }} />
            <Stack.Screen name="study" options={{ title: 'Study', headerShown: false }} />
            <Stack.Screen name="bank" options={{ title: 'Vocabulary Bank', headerShown: false }} />
            <Stack.Screen name="add" options={{ title: 'Add Vocabulary', headerShown: false }} />
            <Stack.Screen name="manual-add" options={{ title: 'Quick Add', headerShown: false }} />
            <Stack.Screen name="course-library" options={{ title: 'Course', headerShown: false }} />
            <Stack.Screen name="smart-import" options={{ title: 'Smart Import', headerShown: false }} />
            <Stack.Screen name="image-import" options={{ title: 'Smart Import' }} />
            <Stack.Screen name="vocabulary/[cardId]" options={{ title: 'Vocabulary' }} />
            <Stack.Screen name="collections" options={{ title: 'Collections' }} />
            <Stack.Screen name="imports" options={{ title: 'Smart Imports' }} />
            <Stack.Screen name="import-staging" options={{ title: 'Review Import' }} />
            <Stack.Screen name="auth" options={{ title: 'Account', presentation: 'modal' }} />
            <Stack.Screen name="stats" options={{ title: 'Stats' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          </Stack>
          <AppBottomNav />
        </View>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
