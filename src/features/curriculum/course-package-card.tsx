import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Chip, Surface } from '@/components/primitives';
import type { CurriculumPackage } from '@/curriculum/catalog';
import { curriculumSelectionKey } from '@/curriculum/catalog';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const UNIT_ICONS: Record<number, string> = {
  1: '👋',
  2: '⏰',
  3: '🏠',
  4: '🧭',
  5: '🛍️',
  6: '💬',
};

interface CoursePackageCardProps {
  pkg: CurriculumPackage;
  missionNumber: number;
  expanded: boolean;
  selectedKeys: ReadonlySet<string>;
  onToggleExpanded: () => void;
  onToggleItem: (packageId: string, itemId: string) => void;
  onToggleVisible: (pkg: CurriculumPackage, select: boolean) => void;
}

export function CoursePackageCard({
  pkg,
  missionNumber,
  expanded,
  selectedKeys,
  onToggleExpanded,
  onToggleItem,
  onToggleVisible,
}: CoursePackageCardProps) {
  const [showDialogue, setShowDialogue] = useState(false);
  const selectedCount = pkg.items.filter((item) => selectedKeys.has(curriculumSelectionKey(pkg.id, item.id))).length;
  const allSelected = pkg.items.length > 0 && selectedCount === pkg.items.length;
  const unitIcon = UNIT_ICONS[pkg.unitNumber] ?? '⭐';

  return (
    <Surface style={{ overflow: 'hidden', borderWidth: expanded ? 2 : 1, borderColor: expanded ? colors.ink : colors.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Collapse' : 'Open'} mission ${pkg.title}`}
        onPress={onToggleExpanded}
        style={({ pressed }) => ({
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 20,
              backgroundColor: expanded ? colors.ink : colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}
          >
            <Text aria-hidden style={{ fontSize: 23 }}>{unitIcon}</Text>
            <Text selectable style={{ color: expanded ? colors.surfaceMuted : colors.inkMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 }}>
              M{missionNumber}
            </Text>
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <Text selectable numberOfLines={2} style={{ color: colors.ink, fontSize: typography.body, fontWeight: '900', lineHeight: 21 }}>
              {pkg.title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>
                World {pkg.unitNumber}
              </Text>
              <Text aria-hidden style={{ color: colors.border }}>•</Text>
              <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>
                🎴 {pkg.items.length} cards
              </Text>
              {selectedCount ? (
                <Text selectable style={{ color: colors.success, fontSize: typography.small, fontWeight: '900' }}>
                  ✓ {selectedCount} packed
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Text aria-hidden style={{ color: colors.ink, fontSize: 22, lineHeight: 22 }}>{expanded ? '−' : '+'}</Text>
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: spacing.md }}>
          <View style={{ gap: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text selectable style={{ flex: 1, color: colors.inkMuted, fontSize: typography.small, fontWeight: '800' }}>
                {pkg.unitTitle}
              </Text>
              <Chip>Reward · {pkg.items.length}</Chip>
            </View>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 20 }}>
              {pkg.description}
            </Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, writingDirection: 'rtl', textAlign: 'left' }}>
              {pkg.unitTitleAr}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onToggleVisible(pkg, !allSelected)}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: radius.pill,
                backgroundColor: allSelected ? colors.success : colors.ink,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text selectable style={{ color: colors.surface, fontSize: typography.small, fontWeight: '900' }}>
                {allSelected ? '✓ All packed' : '🎒 Pack all'}
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
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, fontWeight: '800' }}>
                  {showDialogue ? 'Hide scene' : '💬 Preview scene'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {showDialogue ? (
            <View style={{ gap: 6, backgroundColor: colors.surfaceMuted, padding: spacing.md, borderRadius: radius.lg }}>
              <Text selectable style={{ color: colors.inkMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>MISSION SCENE</Text>
              {pkg.dialogue.map((line) => (
                <Text key={line} selectable style={{ color: colors.ink, fontSize: typography.label, lineHeight: 20 }}>{line}</Text>
              ))}
            </View>
          ) : null}

          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' }}>
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
                    minHeight: 56,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                    backgroundColor: selected ? colors.successSurface : colors.surface,
                    opacity: pressed ? 0.72 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 27,
                      height: 27,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: selected ? colors.success : colors.border,
                      backgroundColor: selected ? colors.success : colors.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: selected ? colors.surface : colors.inkMuted, fontSize: 15, fontWeight: '900' }}>{selected ? '✓' : '+'}</Text>
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <Text selectable style={{ color: colors.ink, fontSize: typography.label, fontWeight: '800' }}>{item.term}</Text>
                    <Text selectable numberOfLines={1} style={{ color: colors.inkMuted, fontSize: typography.small, writingDirection: 'rtl', textAlign: 'left' }}>
                      {item.translation}
                    </Text>
                  </View>

                  <Text selectable style={{ color: colors.inkMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>
                    {item.kind === 'PHRASE' ? 'PHRASE' : 'WORD'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </Surface>
  );
}
