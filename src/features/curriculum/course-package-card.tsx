import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Chip, Surface } from '@/components/primitives';
import type { CurriculumPackage } from '@/curriculum/catalog';
import { curriculumSelectionKey } from '@/curriculum/catalog';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface CoursePackageCardProps {
  pkg: CurriculumPackage;
  expanded: boolean;
  selectedKeys: ReadonlySet<string>;
  onToggleExpanded: () => void;
  onToggleItem: (packageId: string, itemId: string) => void;
  onToggleVisible: (pkg: CurriculumPackage, select: boolean) => void;
}

export function CoursePackageCard({
  pkg,
  expanded,
  selectedKeys,
  onToggleExpanded,
  onToggleItem,
  onToggleVisible,
}: CoursePackageCardProps) {
  const [showDialogue, setShowDialogue] = useState(false);
  const selectedCount = pkg.items.filter((item) => selectedKeys.has(curriculumSelectionKey(pkg.id, item.id))).length;
  const allSelected = pkg.items.length > 0 && selectedCount === pkg.items.length;

  return (
    <Surface style={{ overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Collapse' : 'Open'} ${pkg.title}`}
        onPress={onToggleExpanded}
        style={({ pressed }) => ({
          paddingHorizontal: spacing.md,
          paddingVertical: 14,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text selectable style={{ color: colors.ink, fontSize: typography.label, fontWeight: '900' }}>U{pkg.unitNumber}</Text>
          </View>

          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable numberOfLines={2} style={{ color: colors.ink, fontSize: typography.body, fontWeight: '800' }}>
              {pkg.title}
            </Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>
              {pkg.items.length} {pkg.items.length === 1 ? 'entry' : 'entries'}{selectedCount ? ` · ${selectedCount} selected` : ''}
            </Text>
          </View>

          <Text aria-hidden style={{ color: colors.inkMuted, fontSize: 24, lineHeight: 24 }}>{expanded ? '⌄' : '›'}</Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: spacing.md }}>
          <View style={{ gap: 4 }}>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '800' }}>
              {pkg.unitTitle} · {pkg.unitTitleAr}
            </Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 20 }}>
              {pkg.description}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onToggleVisible(pkg, !allSelected)}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: radius.pill,
                backgroundColor: allSelected ? colors.accent : colors.surfaceMuted,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text selectable style={{ color: allSelected ? colors.surface : colors.ink, fontSize: typography.small, fontWeight: '800' }}>
                {allSelected ? 'Clear topic' : 'Select all'}
              </Text>
            </Pressable>

            {pkg.dialogue.length ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowDialogue((current) => !current)}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: radius.pill,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '800' }}>
                  {showDialogue ? 'Hide dialogue' : 'Preview dialogue'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {showDialogue ? (
            <View style={{ gap: 5, backgroundColor: colors.surfaceMuted, padding: spacing.sm, borderRadius: radius.md }}>
              {pkg.dialogue.map((line) => (
                <Text key={line} selectable style={{ color: colors.ink, fontSize: typography.label, lineHeight: 20 }}>{line}</Text>
              ))}
            </View>
          ) : null}

          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' }}>
            {pkg.items.map((item, index) => {
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
                    minHeight: 52,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 8,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                    backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                    opacity: pressed ? 0.72 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 21,
                      height: 21,
                      borderRadius: 7,
                      borderWidth: 2,
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected ? colors.accent : colors.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: colors.surface, fontSize: 12, fontWeight: '900' }}>{selected ? '✓' : ''}</Text>
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <Text selectable style={{ color: colors.ink, fontSize: typography.label, fontWeight: '750' }}>{item.term}</Text>
                    <Text selectable numberOfLines={1} style={{ color: colors.inkMuted, fontSize: typography.small, writingDirection: 'rtl', textAlign: 'left' }}>
                      {item.translation}
                    </Text>
                  </View>

                  <Chip>{item.kind === 'PHRASE' ? 'Phrase' : 'Word'}</Chip>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </Surface>
  );
}
