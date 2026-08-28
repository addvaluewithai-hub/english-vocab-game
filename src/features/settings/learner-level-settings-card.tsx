import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Chip, Surface } from '@/components/primitives';
import { asSqlDatabase } from '@/data/database';
import { PreferencesRepository } from '@/data/preferences';
import {
  DEFAULT_LEARNER_LEVEL,
  isLearnerLevel,
  type LearnerLevel,
} from '@/imports/ranking';
import { colors, spacing } from '@/theme/tokens';

const LEVELS: LearnerLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function LearnerLevelSettingsCard() {
  const sqlite = useSQLiteContext();
  const [level, setLevel] = useState<LearnerLevel>(DEFAULT_LEARNER_LEVEL);

  useEffect(() => {
    let cancelled = false;
    const repo = new PreferencesRepository(asSqlDatabase(sqlite));
    void repo.get('learner_level').then((value) => {
      if (!cancelled && isLearnerLevel(value)) setLevel(value);
    });
    return () => { cancelled = true; };
  }, [sqlite]);

  async function choose(next: LearnerLevel): Promise<void> {
    await new PreferencesRepository(asSqlDatabase(sqlite)).set('learner_level', next);
    setLevel(next);
  }

  return (
    <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
      <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Approximate learning level</Text>
      <Text selectable style={{ color: colors.inkMuted, lineHeight: 22 }}>
        Smart imports use this to rank useful vocabulary near your level. It never hides everything outside the selected level.
      </Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {LEVELS.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="radio"
            accessibilityLabel={`CEFR ${item}`}
            accessibilityState={{ checked: item === level }}
            onPress={() => void choose(item)}
          >
            <Chip>{item === level ? `${item} · ACTIVE` : item}</Chip>
          </Pressable>
        ))}
      </View>
    </Surface>
  );
}
