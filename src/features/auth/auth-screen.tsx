import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, Chip, Surface } from '@/components/primitives';
import { restoreAuthUser, signInWithEmail, signOutFromNeon, signUpWithEmail, type AuthUser } from '@/auth/neon-auth';
import { asSqlDatabase } from '@/data/database';
import { claimGuestLanguagePairs, GUEST_OWNER_KEY, PreferencesRepository } from '@/data/preferences';
import { setActiveStudySession } from '@/study/session-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';

function Input({ label, value, onChangeText, secure = false }: { label: string; value: string; onChangeText: (value: string) => void; secure?: boolean }) {
  return <View style={{ gap: spacing.xs }}><Text style={{ color: colors.ink, fontWeight: '700' }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} secureTextEntry={secure} autoCapitalize={label === 'Email' ? 'none' : 'sentences'} keyboardType={label === 'Email' ? 'email-address' : 'default'} style={{ minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface, color: colors.ink }} /></View>;
}

export function AuthScreen() {
  const router = useRouter();
  const sqlite = useSQLiteContext();
  const prefs = new PreferencesRepository(asSqlDatabase(sqlite));
  const [mode, setMode] = useState<'SIGN_IN' | 'SIGN_UP'>('SIGN_IN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void restoreAuthUser().then((restored) => { if (!cancelled) setUser(restored); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, []);

  async function adoptUser(nextUser: AuthUser) {
    const guestPairs = await prefs.listLanguagePairs(GUEST_OWNER_KEY);
    if (guestPairs.length) await claimGuestLanguagePairs(sqlite, nextUser.id);
    else await prefs.set('active_owner_key', nextUser.id);
    await prefs.set('last_account_email', nextUser.email);
    setActiveStudySession(null);
    setUser(nextUser);
  }

  async function submit() {
    if (!email.trim() || password.length < 8 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const nextUser = mode === 'SIGN_IN' ? await signInWithEmail(email, password) : await signUpWithEmail(email, password, name);
      await adoptUser(nextUser);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await signOutFromNeon();
    } finally {
      await prefs.set('active_owner_key', GUEST_OWNER_KEY);
      setActiveStudySession(null);
      setUser(null);
      setBusy(false);
    }
  }

  if (user) {
    return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl }} style={{ flex: 1, backgroundColor: colors.canvas }}><Surface style={{ padding: spacing.xl, gap: spacing.md }}><Chip>NEON ACCOUNT</Chip><Text selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>{user.name || user.email}</Text><Text selectable style={{ color: colors.inkMuted }}>{user.email}</Text><Text selectable style={{ color: colors.inkMuted, lineHeight: 23 }}>Local study stays available even if the network or auth service is unavailable. Cloud synchronization begins in T021.</Text><ActionButton label="Back to settings" onPress={() => router.replace('/settings')} /><ActionButton label={busy ? 'Signing out…' : 'Sign out'} tone="danger" disabled={busy} onPress={() => void signOut()} /></Surface></ScrollView>;
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Surface style={{ padding: spacing.xl, gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}><Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>{mode === 'SIGN_IN' ? 'Sign in' : 'Create account'}</Text><Text selectable style={{ color: colors.inkMuted, lineHeight: 23 }}>An account is optional. It will be used for secure Neon backup and multi-device sync.</Text></View>
        {error ? <Text selectable style={{ color: colors.danger, lineHeight: 22 }}>{error}</Text> : null}
        {mode === 'SIGN_UP' ? <Input label="Name" value={name} onChangeText={setName} /> : null}
        <Input label="Email" value={email} onChangeText={setEmail} />
        <Input label="Password" value={password} onChangeText={setPassword} secure />
        <ActionButton label={busy ? 'Please wait…' : mode === 'SIGN_IN' ? 'Sign in' : 'Create account'} disabled={busy || !email.trim() || password.length < 8} onPress={() => void submit()} />
        <ActionButton label={mode === 'SIGN_IN' ? 'Need an account? Sign up' : 'Already have an account? Sign in'} onPress={() => { setMode((current) => current === 'SIGN_IN' ? 'SIGN_UP' : 'SIGN_IN'); setError(null); }} />
        <ActionButton label="Continue as guest" onPress={() => router.back()} />
      </Surface>
    </ScrollView>
  );
}
