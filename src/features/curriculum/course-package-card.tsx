import { Pressable, Text, View } from 'react-native';
import { Chip, Surface } from '@/components/primitives';
import type { CurriculumPackage } from '@/curriculum/catalog';
import { curriculumSelectionKey } from '@/curriculum/catalog';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface CoursePackageCardProps {
  pkg: CurriculumPackage;
  selectedKeys: ReadonlySet<string>;
  onToggleItem: (packageId: string, itemId: string) => void;
  onToggleVisible: (pkg: CurriculumPackage, select: boolean) => void;
}

export function CoursePackageCard({ pkg, selectedKeys, onToggleItem, onToggleVisible }: CoursePackageCardProps) {
  const selectedCount = pkg.items.filter((item) => selectedKeys.has(curriculumSelectionKey(pkg.id, item.id))).length;
  const allSelected = pkg.items.length > 0 && selectedCount === pkg.items.length;

  return (
    <Surface style={{ padding: spacing.md, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
        <Chip>{pkg.level}</Chip>
        <Chip>Unit {pkg.unitNumber}</Chip>
        <Chip>{selectedCount}/{pkg.items.length} selected</Chip>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text selectable style={{ color: colors.ink, fontSize: 21, fontWeight: '800' }}>{pkg.title}</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, writingDirection: 'rtl', textAlign: 'left' }}>{pkg.unitTitleAr}</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 24 }}>{pkg.description}</Text>
      </View>

      <View style={{ gap: spacing.xs, backgroundColor: colors.surfaceMuted, padding: spacing.md, borderRadius: radius.md, borderCurve: 'continuous' }}>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '800' }}>CONVERSATION CONTEXT</Text>
        {pkg.dialogue.map((line) => (
          <Text key={line} selectable style={{ color: colors.ink, fontSize: typography.label, lineHeight: 21 }}>{line}</Text>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={allSelected ? `Clear visible items in ${pkg.title}` : `Select visible items in ${pkg.title}`}
        onPress={() => onToggleVisible(pkg, !allSelected)}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceMuted,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text selectable style={{ color: colors.ink, fontWeight: '800' }}>{allSelected ? 'Clear visible' : 'Select visible'}</Text>
      </Pressable>

      <View style={{ gap: spacing.sm }}>
        {pkg.items.map((item) => {
          const key = curriculumSelectionKey(pkg.id, item.id);
          const selected = selectedKeys.has(key);
          return (
            <Pressable
              key={key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${item.term}, ${item.translation}`}
              onPress={() => onToggleItem(pkg.id, item.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                minHeight: 58,
                padding: spacing.sm,
                borderWidth: 1,
                borderColor: selected ? colors.accent : colors.border,
                backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.surface, fontSize: 14, fontWeight: '900' }}>{selected ? '✓' : ''}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text selectable style={{ color: colors.ink, fontSize: typography.body, fontWeight: '750' }}>{item.term}</Text>
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, writingDirection: 'rtl', textAlign: 'left' }}>{item.translation}</Text>
              </View>
              <Chip>{item.kind === 'PHRASE' ? 'Phrase' : 'Word'}</Chip>
            </Pressable>
          );
        })}
      </View>
    </Surface>
  );
}
