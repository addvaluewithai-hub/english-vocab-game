import { Alert, ScrollView, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { resetAndSeedDemoDatabase } from '@/data/seed';
import { ActionButton } from '@/components/primitives';
import { colors, spacing, typography } from '@/theme/tokens';
import { setActiveStudySession } from '@/study/session-store';

export default function SettingsRoute() {
  const db = useSQLiteContext();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ fontSize: typography.title, fontWeight: '800', color: colors.ink }}>Developer utilities</Text>
        <Text selectable style={{ fontSize: typography.body, lineHeight: 25, color: colors.inkMuted }}>Reset the local database to deterministic demo cards for repeatable development and screenshots.</Text>
      </View>
      {__DEV__ ? (
        <ActionButton
          label="Reset demo vocabulary"
          tone="danger"
          onPress={() => {
            void resetAndSeedDemoDatabase(db)
              .then(() => {
                setActiveStudySession(null);
                Alert.alert('Demo data reset', 'Return to Study to start a fresh session.');
              })
              .catch((error: unknown) => Alert.alert('Reset failed', error instanceof Error ? error.message : 'Unknown error'));
          }}
        />
      ) : null}
    </ScrollView>
  );
}
