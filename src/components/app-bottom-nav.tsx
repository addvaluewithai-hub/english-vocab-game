import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const ITEMS = [
  { label: 'Home', icon: '⌂', href: '/' },
  { label: 'Study', icon: '⚡', href: '/study' },
  { label: 'Course', icon: '🗺️', href: '/course-library' },
  { label: 'Bank', icon: '▤', href: '/bank' },
  { label: 'Add', icon: '+', href: '/add' },
] as const;

function activeSection(pathname: string) {
  if (pathname === '/') return '/';
  if (pathname.startsWith('/study')) return '/study';
  if (pathname.startsWith('/course-library')) return '/course-library';
  if (pathname.startsWith('/bank') || pathname.startsWith('/collections') || pathname.startsWith('/vocabulary/')) return '/bank';
  if (pathname.startsWith('/add') || pathname.startsWith('/smart-import') || pathname.startsWith('/image-import') || pathname.startsWith('/imports') || pathname.startsWith('/import-staging')) return '/add';
  if (pathname.startsWith('/stats') || pathname.startsWith('/settings')) return '/';
  return null;
}

export function AppBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const active = activeSection(pathname);

  if (pathname.startsWith('/auth')) return null;

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        gap: 4,
        paddingTop: 8,
        paddingHorizontal: spacing.sm,
        paddingBottom: Math.max(insets.bottom, 8),
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      {ITEMS.map((item) => {
        const selected = active === item.href;
        return (
          <Pressable
            key={item.href}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            onPress={() => router.replace(item.href)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 52,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              borderRadius: radius.md,
              backgroundColor: selected ? colors.surfaceMuted : 'transparent',
              opacity: pressed ? 0.64 : 1,
            })}
          >
            <Text aria-hidden style={{ color: selected ? colors.ink : colors.inkMuted, fontSize: item.label === 'Add' ? 25 : 20, lineHeight: 24, fontWeight: '900' }}>{item.icon}</Text>
            <Text style={{ color: selected ? colors.ink : colors.inkMuted, fontSize: typography.small, fontWeight: selected ? '900' : '700' }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
