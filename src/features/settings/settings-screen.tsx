import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { LanguagePair } from '@/domain/types';
import { ActionButton, Chip, Surface } from '@/components/primitives';
import { asSqlDatabase } from '@/data/database';
import { GUEST_OWNER_KEY, PreferencesRepository } from '@/data/preferences';
import { resetAndSeedDemoDatabase } from '@/data/seed';
import { setActiveStudySession } from '@/study/session-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';

function LanguageInput({ label, code, setCode, name, setName }: { label: string; code: string; setCode: (value: string) => void; name: string; setName: (value: string) => void }) {
  return <View style={{ gap: spacing.xs }}><Text style={{ color: colors.ink, fontWeight: '700' }}>{label}</Text><View style={{ flexDirection: 'row', gap: spacing.sm }}><TextInput accessibilityLabel={`${label} code`} value={code} onChangeText={setCode} autoCapitalize="none" placeholder="en" maxLength={12} style={{ width: 78, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.surface }} /><TextInput accessibilityLabel={`${label} name`} value={name} onChangeText={setName} placeholder="English" style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.surface }} /></View></View>;
}

async function readSettings(sqlite: SQLiteDatabase): Promise<{
  ownerKey: string;
  activeId: string | null;
  pairs: LanguagePair[];
}> {
  const repo = new PreferencesRepository(asSqlDatabase(sqlite));
  const preferences = await repo.load();
  const pairs = await repo.listLanguagePairs(preferences.activeOwnerKey);
  return {
    ownerKey: preferences.activeOwnerKey,
    activeId: preferences.activeLanguagePairId,
    pairs,
  };
}

export function SettingsScreen() {
  const sqlite = useSQLiteContext();
  const repo = new PreferencesRepository(asSqlDatabase(sqlite));
  const [ownerKey, setOwnerKey] = useState(GUEST_OWNER_KEY);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pairs, setPairs] = useState<LanguagePair[]>([]);
  const [targetCode, setTargetCode] = useState('en');
  const [targetName, setTargetName] = useState('English');
  const [referenceCode, setReferenceCode] = useState('ar');
  const [referenceName, setReferenceName] = useState('Arabic');
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    const next = await readSettings(sqlite);
    setOwnerKey(next.ownerKey);
    setActiveId(next.activeId);
    setPairs(next.pairs);
  }

  useEffect(() => {
    let cancelled = false;

    void readSettings(sqlite)
      .then((next) => {
        if (cancelled) return;
        setOwnerKey(next.ownerKey);
        setActiveId(next.activeId);
        setPairs(next.pairs);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load settings.');
      });

    return () => {
      cancelled = true;
    };
  }, [sqlite]);

  async function choosePair(id: string) {
    await repo.set('active_language_pair_id', id);
    setActiveStudySession(null);
    setActiveId(id);
  }

  async function createPair() {
    try {
      if (!targetCode.trim() || !targetName.trim() || !referenceCode.trim() || !referenceName.trim()) throw new Error('Both languages need a code and a name.');
      const pair = await repo.createLanguagePair({ ownerKey, targetLanguageCode: targetCode, targetLanguageName: targetName, referenceLanguageCode: referenceCode, referenceLanguageName: referenceName });
      await choosePair(pair.id);
      await reload();
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create language pair.');
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs }}><Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '800' }}>Languages & settings</Text><Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25 }}>Each language pair has its own bank and study queue.</Text></View>
      {error ? <Surface style={{ padding: spacing.md, backgroundColor: colors.dangerSurface }}><Text style={{ color: colors.danger }}>{error}</Text></Surface> : null}
      <View style={{ gap: spacing.sm }}><Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Active language pair</Text>{pairs.length ? pairs.map((pair) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: activeId === pair.id }} key={pair.id} onPress={() => void choosePair(pair.id)}><Surface style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: activeId === pair.id ? colors.accent : colors.border }}><View style={{ flex: 1 }}><Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>{pair.targetLanguageName}</Text><Text selectable style={{ color: colors.inkMuted }}>meanings in {pair.referenceLanguageName}</Text></View>{activeId === pair.id ? <Chip>ACTIVE</Chip> : null}</Surface></Pressable>) : <Text selectable style={{ color: colors.inkMuted }}>Create your first pair below. No account is required.</Text>}</View>
      <Surface style={{ padding: spacing.md, gap: spacing.md }}><Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Add language pair</Text><LanguageInput label="Learning language" code={targetCode} setCode={setTargetCode} name={targetName} setName={setTargetName} /><LanguageInput label="Explanation language" code={referenceCode} setCode={setReferenceCode} name={referenceName} setName={setReferenceName} /><ActionButton label="Create and use this pair" onPress={() => void createPair()} /></Surface>
      <Surface style={{ padding: spacing.md, gap: spacing.sm }}><Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Cloud account</Text><Text selectable style={{ color: colors.inkMuted, lineHeight: 23 }}>{ownerKey === GUEST_OWNER_KEY ? 'You are studying as a guest. Your data stays local until you choose to create or sign into an account.' : 'This device is scoped to your signed-in account.'}</Text><Link href="/auth" asChild><ActionButton label={ownerKey === GUEST_OWNER_KEY ? 'Sign in or create account' : 'Account'} /></Link></Surface>
      {__DEV__ ? <Surface style={{ padding: spacing.md, gap: spacing.sm }}><Text selectable style={{ color: colors.ink, fontWeight: '800' }}>Developer utilities</Text><ActionButton label="Reset demo vocabulary" tone="danger" onPress={() => Alert.alert('Reset demo data?', 'This only affects the local development database.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: () => void resetAndSeedDemoDatabase(sqlite).then(() => { setActiveStudySession(null); return reload(); }) }])} /></Surface> : null}
    </ScrollView>
  );
}
