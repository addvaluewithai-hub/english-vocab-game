import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { isNeonCloudConfigured } from '@/cloud/neon-client';
import type { LanguagePair } from '@/domain/types';
import { ActionButton, Chip, Surface } from '@/components/primitives';
import { asSqlDatabase } from '@/data/database';
import { GUEST_OWNER_KEY, PreferencesRepository } from '@/data/preferences';
import { resetAndSeedDemoDatabase } from '@/data/seed';
import { syncCloudNow } from '@/sync/coordinator';
import { getOrCreateSyncClientId } from '@/sync/engine';
import { NeonDataApiSyncTransport } from '@/sync/neon-transport';
import { SyncRecoveryService } from '@/sync/recovery';
import { useSyncStatus } from '@/sync/use-sync-status';
import { setActiveStudySession } from '@/study/session-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { ReminderSettingsCard } from './reminder-settings-card';

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

function LanguageInput({ label, code, setCode, name, setName, namePlaceholder }: { label: string; code: string; setCode: (value: string) => void; name: string; setName: (value: string) => void; namePlaceholder: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.ink, fontWeight: '800', ...rtlText }}>{label}</Text>
      <View style={{ flexDirection: 'row-reverse', gap: spacing.sm }}>
        <TextInput accessibilityLabel={`${label} - الكود`} value={code} onChangeText={setCode} autoCapitalize="none" placeholder="en" maxLength={12} style={{ width: 78, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.surface, textAlign: 'center' }} />
        <TextInput accessibilityLabel={`${label} - الاسم`} value={name} onChangeText={setName} placeholder={namePlaceholder} style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.surface, ...rtlText }} />
      </View>
    </View>
  );
}

async function readSettings(sqlite: SQLiteDatabase): Promise<{ ownerKey: string; activeId: string | null; pairs: LanguagePair[] }> {
  const repo = new PreferencesRepository(asSqlDatabase(sqlite));
  const preferences = await repo.load();
  const pairs = await repo.listLanguagePairs(preferences.activeOwnerKey);
  return { ownerKey: preferences.activeOwnerKey, activeId: preferences.activeLanguagePairId, pairs };
}

function syncLabel(phase: 'IDLE' | 'SYNCING' | 'OFFLINE' | 'ERROR', pending: number): string {
  if (phase === 'SYNCING') return 'بنعمل مزامنة دلوقتي…';
  if (phase === 'OFFLINE') return pending ? `مفيش نت · ${pending} تغيير مستني` : 'مفيش نت · المذاكرة المحلية شغالة عادي';
  if (phase === 'ERROR') return 'في شوية تغييرات محتاجة محاولة تانية';
  return pending ? `${pending} تغيير مستني المزامنة` : 'كله متزامن';
}

function syncPhaseLabel(phase: 'IDLE' | 'SYNCING' | 'OFFLINE' | 'ERROR'): string {
  if (phase === 'SYNCING') return 'بنعمل مزامنة';
  if (phase === 'OFFLINE') return 'أوفلاين';
  if (phase === 'ERROR') return 'محتاج مراجعة';
  return 'تمام';
}

export function SettingsScreen() {
  const sqlite = useSQLiteContext();
  const repo = new PreferencesRepository(asSqlDatabase(sqlite));
  const sync = useSyncStatus();
  const [ownerKey, setOwnerKey] = useState(GUEST_OWNER_KEY);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pairs, setPairs] = useState<LanguagePair[]>([]);
  const [targetCode, setTargetCode] = useState('en');
  const [targetName, setTargetName] = useState('English');
  const [referenceCode, setReferenceCode] = useState('ar');
  const [referenceName, setReferenceName] = useState('Arabic');
  const [syncBusy, setSyncBusy] = useState(false);
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
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'مقدرناش نفتح الإعدادات دلوقتي.');
      });
    return () => { cancelled = true; };
  }, [sqlite]);

  async function choosePair(id: string) {
    await repo.set('active_language_pair_id', id);
    setActiveStudySession(null);
    setActiveId(id);
  }

  async function createPair() {
    try {
      if (!targetCode.trim() || !targetName.trim() || !referenceCode.trim() || !referenceName.trim()) throw new Error('كل لغة محتاجة كود واسم.');
      const pair = await repo.createLanguagePair({ ownerKey, targetLanguageCode: targetCode, targetLanguageName: targetName, referenceLanguageCode: referenceCode, referenceLanguageName: referenceName });
      await choosePair(pair.id);
      await reload();
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'مقدرناش نضيف اللغة دي.');
    }
  }

  async function runSync() {
    if (ownerKey === GUEST_OWNER_KEY || syncBusy) return;
    setSyncBusy(true);
    setError(null);
    try { await syncCloudNow(sqlite, ownerKey); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'المزامنة مشتغلتش دلوقتي. جرّب تاني.'); }
    finally { setSyncBusy(false); }
  }

  async function retryBlocked() {
    setSyncBusy(true);
    try {
      await new SyncRecoveryService(sqlite).retryAllBlocked(ownerKey);
      await syncCloudNow(sqlite, ownerKey);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'مقدرناش نعيد المحاولات دلوقتي.');
    } finally { setSyncBusy(false); }
  }

  async function restoreFromCloud() {
    setSyncBusy(true);
    setError(null);
    try {
      const clientId = await getOrCreateSyncClientId(sqlite);
      await new SyncRecoveryService(sqlite).resetLocalAndRestore(ownerKey, clientId, new NeonDataApiSyncTransport());
      setActiveStudySession(null);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'مقدرناش نرجّع النسخة من السحابة.');
    } finally { setSyncBusy(false); }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 80 }} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
        <Text accessibilityRole="header" selectable style={{ color: colors.ink, fontSize: typography.title, fontWeight: '900', ...rtlText }}>الإعدادات</Text>
        <Text selectable style={{ color: colors.inkMuted, fontSize: typography.body, lineHeight: 25, ...rtlText }}>ظبط الحساب، التنبيهات، والمزامنة. التطبيق بيبدأ تلقائي على English → Arabic.</Text>
      </View>

      {error ? <Surface style={{ padding: spacing.md, backgroundColor: colors.dangerSurface }}><Text style={{ color: colors.danger, ...rtlText }}>{error}</Text></Surface> : null}

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>لغة المذاكرة</Text>
        {pairs.length ? pairs.map((pair) => (
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: activeId === pair.id }} key={pair.id} onPress={() => void choosePair(pair.id)}>
            <Surface style={{ padding: spacing.md, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, borderColor: activeId === pair.id ? colors.accent : colors.border }}>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: '800', ...rtlText }}>{pair.targetLanguageName}</Text>
                <Text selectable style={{ color: colors.inkMuted, ...rtlText }}>المعاني بـ {pair.referenceLanguageName}</Text>
              </View>
              {activeId === pair.id ? <Chip>المستخدمة دلوقتي</Chip> : null}
            </Surface>
          </Pressable>
        )) : <Text selectable style={{ color: colors.inkMuted, ...rtlText }}>بنجهز English → Arabic تلقائي.</Text>}
      </View>

      <Surface style={{ padding: spacing.md, gap: spacing.md }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>إعداد متقدم: ضيف لغة تانية</Text>
        <Text selectable style={{ color: colors.inkMuted, lineHeight: 22, ...rtlText }}>مش محتاج تعمل ده عشان تبدأ. استخدمه بس لو عايز بنك منفصل للغة مختلفة.</Text>
        <LanguageInput label="اللغة اللي بتتعلمها" code={targetCode} setCode={setTargetCode} name={targetName} setName={setTargetName} namePlaceholder="English" />
        <LanguageInput label="لغة الشرح" code={referenceCode} setCode={setReferenceCode} name={referenceName} setName={setReferenceName} namePlaceholder="Arabic" />
        <ActionButton label="ضيف واستخدم اللغة دي" onPress={() => void createPair()} />
      </Surface>

      {activeId ? <ReminderSettingsCard languagePairId={activeId} /> : null}

      <Surface style={{ padding: spacing.md, gap: spacing.sm, alignItems: 'flex-end' }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>الحساب</Text>
        <Text selectable style={{ color: colors.inkMuted, lineHeight: 23, ...rtlText }}>{ownerKey === GUEST_OWNER_KEY ? 'إنت داخل كضيف دلوقتي. بياناتك موجودة على الجهاز لحد ما تختار تعمل حساب أو تدخل على حسابك.' : 'الجهاز ده مربوط بحسابك.'}</Text>
        <View style={{ width: '100%' }}><Link href="/auth" asChild><ActionButton label={ownerKey === GUEST_OWNER_KEY ? 'دخول أو حساب جديد' : 'افتح حسابك'} /></Link></View>
      </Surface>

      {ownerKey !== GUEST_OWNER_KEY ? (
        <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
            <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: '900', ...rtlText }}>المزامنة</Text>
            <Chip>{syncPhaseLabel(sync.phase)}</Chip>
          </View>
          <Text accessibilityLiveRegion="polite" selectable style={{ color: colors.inkMuted, lineHeight: 23, ...rtlText }}>{isNeonCloudConfigured() ? syncLabel(sync.phase, sync.pendingCount) : 'المزامنة السحابية مش متظبطة في النسخة دي، بس المذاكرة المحلية شغالة عادي.'}</Text>
          {sync.lastSyncedAt ? <Text selectable style={{ color: colors.inkMuted, fontSize: typography.small, ...rtlText }}>آخر مزامنة: {new Date(sync.lastSyncedAt).toLocaleString('ar-EG')}</Text> : null}
          <ActionButton label={syncBusy || sync.phase === 'SYNCING' ? 'بنعمل مزامنة…' : 'زامن دلوقتي'} disabled={syncBusy || !isNeonCloudConfigured()} onPress={() => void runSync()} />
          {sync.blockedCount > 0 ? <ActionButton label={`جرّب تاني لـ ${sync.blockedCount} تغيير`} onPress={() => void retryBlocked()} disabled={syncBusy} /> : null}
          <ActionButton label="امسح النسخة المحلية ونزّلها تاني" tone="danger" disabled={syncBusy || !isNeonCloudConfigured()} onPress={() => Alert.alert('ننزل بيانات حسابك من جديد؟', 'ده هيمسح النسخة المحلية على الجهاز بس، وبعدها ينزل بياناتك من السحابة. بيانات السحابة نفسها مش هتتمسح.', [{ text: 'لأ', style: 'cancel' }, { text: 'نزّلها تاني', style: 'destructive', onPress: () => void restoreFromCloud() }])} />
        </Surface>
      ) : null}

      {__DEV__ ? (
        <Surface style={{ padding: spacing.md, gap: spacing.sm }}>
          <Text selectable style={{ color: colors.ink, fontWeight: '800', ...rtlText }}>أدوات التطوير</Text>
          <ActionButton label="رجّع بيانات التجربة" tone="danger" onPress={() => Alert.alert('نرجّع بيانات التجربة؟', 'ده هيأثر على قاعدة البيانات المحلية للتطوير بس.', [{ text: 'لأ', style: 'cancel' }, { text: 'رجّعها', style: 'destructive', onPress: () => void resetAndSeedDemoDatabase(sqlite).then(() => { setActiveStudySession(null); return reload(); }) }])} />
        </Surface>
      ) : null}
    </ScrollView>
  );
}
