import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip, Surface } from '@/components/primitives';
import { curriculumSelectionKey, type CurriculumPackage } from '@/curriculum/catalog';
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
  expanded: boolean;
  selectedKeys: ReadonlySet<string>;
  onToggleExpanded: () => void;
  onToggleItem: (packageId: string, itemId: string) => void;
  onToggleVisible: (pkg: CurriculumPackage, select: boolean) => void;
}

const COLLAPSED_REWARD_LIMIT = 24;

export function CoursePackageCard({
  pkg,
  expanded,
  selectedKeys,
  onToggleExpanded,
  onToggleItem,
  onToggleVisible,
}: CoursePackageCardProps) {
  const router = useRouter();
  const [showAllRewards, setShowAllRewards] = useState(false);
  const selectedCount = pkg.items.filter((item) => selectedKeys.has(curriculumSelectionKey(pkg.id, item.id))).length;
  const allSelected = pkg.items.length > 0 && selectedCount === pkg.items.length;
  const unitIcon = UNIT_ICONS[pkg.unitNumber] ?? '⭐';
  const visibleItems = showAllRewards ? pkg.items : pkg.items.slice(0, COLLAPSED_REWARD_LIMIT);

  return (
    <Surface style={{ overflow: 'hidden', borderWidth: expanded ? 2 : 1, borderColor: expanded ? colors.ink : colors.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Collapse' : 'Open'} mission ${pkg.title}`}
        onPress={onToggleExpanded}
        style={({ pressed }) => ({ paddingHorizontal: spacing.md, paddingVertical: spacing.md, opacity: pressed ? 0.72 : 1 })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: expanded ? colors.ink : colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <Text aria-hidden style={{ fontSize: 23 }}>{unitIcon}</Text>
            <Text selectable style={{ color: expanded ? colors.surfaceMuted : colors.inkMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 }}>
              M{pkg.sequence}
            </Text>
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <Text selectable numberOfLines={2} style={{ color: colors.ink, fontSize: typography.body, fontWeight: '900', lineHeight: 21 }}>
              {pkg.title}
            </Text>
            <Text selectable numberOfLines={1} style={{ color: colors.inkMuted, fontSize: typography.small, writingDirection: 'rtl', textAlign: 'left' }}>
              {pkg.titleAr}
            </Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small }}>
              {pkg.items.length} words & phrases{selectedCount ? ` · ✓ ${selectedCount} selected` : ''}
            </Text>
          </View>

          <View style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Text aria-hidden style={{ color: colors.ink, fontSize: 22, lineHeight: 22 }}>{expanded ? '−' : '+'}</Text>
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: spacing.md }}>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
              <Chip>World {pkg.unitNumber}</Chip>
              <Chip>{pkg.items.length} items</Chip>
            </View>
            <Text selectable style={{ color: colors.ink, fontSize: typography.label, fontWeight: '900' }}>What you will learn</Text>
            <Text selectable style={{ color: colors.inkMuted, fontSize: typography.label, lineHeight: 20 }}>{pkg.description}</Text>
          </View>

          {pkg.personalizationPrompt ? (
            <View style={{ padding: spacing.md, gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text aria-hidden style={{ fontSize: 24 }}>🪪</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text selectable style={{ color: colors.ink, fontSize: typography.label, fontWeight: '900' }}>{pkg.personalizationPrompt.title}</Text>
                  <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, lineHeight: 18 }}>{pkg.personalizationPrompt.description}</Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" onPress={() => router.push('/manual-add')} style={({ pressed }) => ({ alignSelf: 'flex-start', paddingVertical: 5, opacity: pressed ? 0.65 : 1 })}>
                <Text selectable style={{ color: colors.accent, fontSize: typography.small, fontWeight: '900' }}>Add my own word →</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onToggleVisible(pkg, !allSelected)}
              style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: allSelected ? colors.success : colors.ink, opacity: pressed ? 0.7 : 1 })}
            >
              <Text selectable style={{ color: colors.surface, fontSize: typography.small, fontWeight: '900' }}>
                {allSelected ? '✓ All selected' : 'Select all'}
              </Text>
            </Pressable>
            <Text selectable style={{ flex: 1, color: colors.inkMuted, fontSize: typography.small }}>
              Or choose only the words you want.
            </Text>
          </View>

          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' }}>
            {visibleItems.map((item, index) => {
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
                  <View style={{ width: 27, height: 27, borderRadius: 10, borderWidth: 2, borderColor: selected ? colors.success : colors.border, backgroundColor: selected ? colors.success : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: selected ? colors.surface : colors.inkMuted, fontSize: 15, fontWeight: '900' }}>{selected ? '✓' : '+'}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text selectable style={{ color: colors.ink, fontSize: typography.label, fontWeight: '800' }}>{item.term}</Text>
                    <Text selectable numberOfLines={2} style={{ color: colors.inkMuted, fontSize: typography.small, writingDirection: 'rtl', textAlign: 'left' }}>{item.translation}</Text>
                  </View>
                  <Text selectable style={{ color: colors.inkMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>
                    {item.kind === 'PHRASE' ? 'PHRASE' : 'WORD'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {pkg.items.length > COLLAPSED_REWARD_LIMIT ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAllRewards((current) => !current)}
              style={({ pressed }) => ({ alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, opacity: pressed ? 0.65 : 1 })}
            >
              <Text selectable style={{ color: colors.accent, fontSize: typography.small, fontWeight: '900' }}>
                {showAllRewards ? 'Show fewer ↑' : `Show all ${pkg.items.length} ↓`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Surface>
  );
}
