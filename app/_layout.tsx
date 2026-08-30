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
            <Stack.Screen name="index" options={{ title: 'الرئيسية', headerShown: false }} />
            <Stack.Screen name="study" options={{ title: 'ذاكر', headerShown: false }} />
            <Stack.Screen name="bank" options={{ title: 'كلماتي', headerShown: false }} />
            <Stack.Screen name="add" options={{ title: 'ضيف كلمات', headerShown: false }} />
            <Stack.Screen name="manual-add" options={{ title: 'ضيف بسرعة', headerShown: false }} />
            <Stack.Screen name="course-library" options={{ title: 'الكورس', headerShown: false }} />
            <Stack.Screen name="smart-import" options={{ title: 'إضافة ذكية', headerShown: false }} />
            <Stack.Screen name="image-import" options={{ title: 'إضافة ذكية' }} />
            <Stack.Screen name="vocabulary/[cardId]" options={{ title: 'تفاصيل الكلمة' }} />
            <Stack.Screen name="collections" options={{ title: 'المجموعات' }} />
            <Stack.Screen name="imports" options={{ title: 'الإضافات الذكية' }} />
            <Stack.Screen name="import-staging" options={{ title: 'راجع الكلمات' }} />
            <Stack.Screen name="auth" options={{ title: 'الحساب', presentation: 'modal' }} />
            <Stack.Screen name="stats" options={{ title: 'تقدمك' }} />
            <Stack.Screen name="settings" options={{ title: 'الإعدادات' }} />
          </Stack>
          <AppBottomNav />
        </View>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
