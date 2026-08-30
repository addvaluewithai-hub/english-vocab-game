import { A1_CORE_GROUPS } from './core';
import { A1_FRAMES_A_GROUPS } from './frames-a';
import { A1_FRAMES_B_GROUPS } from './frames-b';
import { A1_PRACTICAL_GROUPS } from './practical';
import type { A1RawGroup } from './raw-types';

export const A1_RAW_GROUPS: readonly A1RawGroup[] = [
  ...A1_CORE_GROUPS,
  ...A1_PRACTICAL_GROUPS,
  ...A1_FRAMES_A_GROUPS,
  ...A1_FRAMES_B_GROUPS,
];

const rawEntries = A1_RAW_GROUPS.flatMap((group) => group.entries);

export const A1_SOURCE_STATS = Object.freeze({
  groupCount: A1_RAW_GROUPS.length,
  rawMemberCount: rawEntries.length,
  distinctMemberCount: new Set(rawEntries.map((entry) => entry.term.trim().toLocaleLowerCase())).size,
});

export function getA1RawGroup(groupId: string): A1RawGroup | undefined {
  return A1_RAW_GROUPS.find((group) => group.id === groupId);
}
