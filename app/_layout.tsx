import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeMahandDatabase } from '@/features/mahand-simple/hard-words-store';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="mahand-simple.db" onInit={initializeMahandDatabase}>
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: colors.canvas }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.canvas },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="study" />
          </Stack>
        </View>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
