import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { LanguagePair } from '@/domain/types';
import { asSqlDatabase } from './database';
import { GUEST_OWNER_KEY, PreferencesRepository } from './preferences';

export interface ActiveLanguageState {
  loading: boolean;
  ownerKey: string;
  pair: LanguagePair | null;
  refresh: () => Promise<void>;
}

export function useActiveLanguagePair(): ActiveLanguageState {
  const sqlite = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [ownerKey, setOwnerKey] = useState(GUEST_OWNER_KEY);
  const [pair, setPair] = useState<LanguagePair | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const repo = new PreferencesRepository(asSqlDatabase(sqlite));
    const preferences = await repo.load();
    const pairs = await repo.listLanguagePairs(preferences.activeOwnerKey);
    const active = pairs.find((item) => item.id === preferences.activeLanguagePairId) ?? pairs[0] ?? null;
    if (active && active.id !== preferences.activeLanguagePairId) {
      await repo.set('active_language_pair_id', active.id);
    }
    setOwnerKey(preferences.activeOwnerKey);
    setPair(active);
    setLoading(false);
  }, [sqlite]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, ownerKey, pair, refresh };
}
