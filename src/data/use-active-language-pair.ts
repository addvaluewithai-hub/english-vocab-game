import { useEffect, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
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

async function readActiveLanguagePair(sqlite: SQLiteDatabase): Promise<{
  ownerKey: string;
  pair: LanguagePair | null;
}> {
  const repo = new PreferencesRepository(asSqlDatabase(sqlite));
  const preferences = await repo.load();
  const pairs = await repo.listLanguagePairs(preferences.activeOwnerKey);
  const active =
    pairs.find((item) => item.id === preferences.activeLanguagePairId) ??
    pairs[0] ??
    null;

  if (active && active.id !== preferences.activeLanguagePairId) {
    await repo.set('active_language_pair_id', active.id);
  }

  return { ownerKey: preferences.activeOwnerKey, pair: active };
}

export function useActiveLanguagePair(): ActiveLanguageState {
  const sqlite = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [ownerKey, setOwnerKey] = useState(GUEST_OWNER_KEY);
  const [pair, setPair] = useState<LanguagePair | null>(null);

  async function refresh(): Promise<void> {
    const next = await readActiveLanguagePair(sqlite);
    setOwnerKey(next.ownerKey);
    setPair(next.pair);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    void readActiveLanguagePair(sqlite).then((next) => {
      if (cancelled) return;
      setOwnerKey(next.ownerKey);
      setPair(next.pair);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [sqlite]);

  return { loading, ownerKey, pair, refresh };
}
