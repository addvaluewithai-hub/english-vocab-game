import type { TermKind } from '@/domain/types';
import { expandA1Group } from './a1/expansion';
import { A1_INTRODUCTION_TO_MISSION, A1_MISSIONS } from './a1/missions';
import { A1_RAW_GROUPS, A1_SOURCE_STATS } from './a1/source';
import type { A1RawGroup } from './a1/raw-types';

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface CurriculumItem {
  id: string;
  sourceLexicalItemId: string;
  term: string;
  translation: string;
  kind: TermKind;
  definition?: string;
}

export interface CurriculumPersonalizationPrompt {
  sourceLexicalItemId: string;
  title: string;
  description: string;
}

export interface CurriculumPackage {
  id: string;
  lessonId: string;
  sequence: number;
  level: CefrLevel;
  unitId: string;
  unitNumber: number;
  unitTitle: string;
  unitTitleAr: string;
  title: string;
  titleAr: string;
  description: string;
  dialogue: readonly string[];
  sourceGroupIds: readonly string[];
  personalizationPrompt?: CurriculumPersonalizationPrompt;
  items: readonly CurriculumItem[];
}

function slug(value: string): string {
  const normalized = value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return normalized.slice(0, 36) || 'item';
}

function inferKind(group: A1RawGroup, term: string): TermKind {
  if (group.itemType === 'frame_set') return 'PHRASE';
  return /\s/.test(term.trim()) ? 'PHRASE' : 'WORD';
}

function groupItems(group: A1RawGroup): CurriculumItem[] {
  return expandA1Group(group).map((entry, index) => ({
    id: `${group.id.replace(/^lexical\./, '')}-${index + 1}-${slug(entry.term)}`,
    sourceLexicalItemId: group.id,
    term: entry.term,
    translation: entry.translation,
    kind: inferKind(group, entry.term),
  }));
}

function uniqueItems(items: readonly CurriculumItem[]): CurriculumItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.term.trim().toLocaleLowerCase()}::${item.translation.trim().toLocaleLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function missionGroupIds(lessonId: string, practiceGroupIds: readonly string[]): string[] {
  const introduced = A1_RAW_GROUPS
    .filter((group) => A1_INTRODUCTION_TO_MISSION[group.introductionLocation] === lessonId)
    .map((group) => group.id);
  return Array.from(new Set([...introduced, ...practiceGroupIds]));
}

function personalizationFor(groups: readonly A1RawGroup[]): CurriculumPersonalizationPrompt | undefined {
  const personalized = groups.find((group) => group.itemType === 'personalized_slot');
  if (!personalized) return undefined;
  return {
    sourceLexicalItemId: personalized.id,
    title: 'Make this mission yours',
    description: 'Add your own country, nationality, and one locally useful comparison pair as personal cards.',
  };
}

export const CURRICULUM_PACKAGES: readonly CurriculumPackage[] = A1_MISSIONS.map((mission) => {
  const sourceGroupIds = missionGroupIds(mission.lessonId, mission.practiceGroupIds);
  const groups = sourceGroupIds
    .map((groupId) => A1_RAW_GROUPS.find((group) => group.id === groupId))
    .filter((group): group is A1RawGroup => Boolean(group));
  const personalizationPrompt = personalizationFor(groups);
  return {
    id: `a1-${mission.lessonId.toLocaleLowerCase()}`,
    lessonId: mission.lessonId,
    sequence: mission.sequence,
    level: 'A1' as const,
    unitId: mission.unitId,
    unitNumber: mission.unitNumber,
    unitTitle: mission.unitTitle,
    unitTitleAr: mission.unitTitleAr,
    title: mission.title,
    titleAr: mission.titleAr,
    description: mission.briefing,
    dialogue: [],
    sourceGroupIds,
    ...(personalizationPrompt ? { personalizationPrompt } : {}),
    items: uniqueItems(groups.flatMap(groupItems)),
  };
});

export const A1_CATALOG_STATS = Object.freeze({
  ...A1_SOURCE_STATS,
  missionCount: CURRICULUM_PACKAGES.length,
  appCardEntries: CURRICULUM_PACKAGES.reduce((sum, pkg) => sum + pkg.items.length, 0),
});

export const CURRICULUM_UNITS = Array.from(
  new Map(CURRICULUM_PACKAGES.map((pkg) => [pkg.unitId, {
    id: pkg.unitId,
    number: pkg.unitNumber,
    title: pkg.unitTitle,
    titleAr: pkg.unitTitleAr,
    missionCount: CURRICULUM_PACKAGES.filter((candidate) => candidate.unitId === pkg.unitId).length,
  }])).values(),
).sort((a, b) => a.number - b.number);

export type CurriculumKindFilter = 'ALL' | TermKind;
export interface CurriculumFilters {
  level: 'ALL' | CefrLevel;
  unitId: 'ALL' | string;
  kind: CurriculumKindFilter;
  query: string;
}

export function filterCurriculumPackages(filters: CurriculumFilters): CurriculumPackage[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return CURRICULUM_PACKAGES.flatMap((pkg) => {
    if (filters.level !== 'ALL' && pkg.level !== filters.level) return [];
    if (filters.unitId !== 'ALL' && pkg.unitId !== filters.unitId) return [];
    const packageMatches = !query || [
      pkg.lessonId,
      pkg.title,
      pkg.titleAr,
      pkg.unitTitle,
      pkg.unitTitleAr,
      pkg.description,
      ...pkg.sourceGroupIds,
    ].some((value) => value.toLocaleLowerCase().includes(query));
    const items = pkg.items.filter((item) => {
      if (filters.kind !== 'ALL' && item.kind !== filters.kind) return false;
      if (packageMatches) return true;
      return [item.term, item.translation, item.sourceLexicalItemId].some((value) => value.toLocaleLowerCase().includes(query));
    });
    return items.length ? [{ ...pkg, items }] : [];
  });
}

export function curriculumSelectionKey(packageId: string, itemId: string): string {
  return `${packageId}::${itemId}`;
}
