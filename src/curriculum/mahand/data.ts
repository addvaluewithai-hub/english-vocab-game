import type { MahandGroup, MahandItem, MahandUnit } from './types';
import { MAHAND_ROWS_01_02 } from './source/units-01-02';
import { MAHAND_ROWS_03_04 } from './source/units-03-04';
import { MAHAND_ROWS_05_06 } from './source/units-05-06';
import { MAHAND_ROWS_07_08 } from './source/units-07-08';
import { MAHAND_ROWS_09_10 } from './source/units-09-10';
import { MAHAND_ROWS_11_12 } from './source/units-11-12';
import { MAHAND_ROWS_13_14 } from './source/units-13-14';
import { MAHAND_ROWS_15_16 } from './source/units-15-16';
import { MAHAND_ROWS_17_18 } from './source/units-17-18';
import { MAHAND_ROWS_19_20 } from './source/units-19-20';

export const MAHAND_COURSE_TITLE = 'مهند';
export const MAHAND_COURSE_DESCRIPTION = 'مرجع مهند الأساسي للمذاكرة من كورس دليلك.';

const RAW_ROWS = [
  MAHAND_ROWS_01_02,
  MAHAND_ROWS_03_04,
  MAHAND_ROWS_05_06,
  MAHAND_ROWS_07_08,
  MAHAND_ROWS_09_10,
  MAHAND_ROWS_11_12,
  MAHAND_ROWS_13_14,
  MAHAND_ROWS_15_16,
  MAHAND_ROWS_17_18,
  MAHAND_ROWS_19_20,
].join('\n');

type ParsedRow = {
  unitNo: number;
  unitTitle: string;
  groupNo: number;
  groupTitle: string;
  page: number;
  item: MahandItem;
};

function text(row: readonly string[], index: number): string {
  return row[index] ?? '';
}

function toItem(row: readonly string[]): ParsedRow {
  const unitNo = Number(text(row, 0));
  const unitTitle = text(row, 1);
  const groupNo = Number(text(row, 2));
  const groupTitle = text(row, 3);
  const page = Number(text(row, 4));
  const wordNo = Number(text(row, 5));
  return {
    unitNo,
    unitTitle,
    groupNo,
    groupTitle,
    page,
    item: {
      id: `mahand-u${String(unitNo).padStart(2, '0')}-g${String(groupNo).padStart(2, '0')}-w${String(wordNo).padStart(3, '0')}`,
      number: wordNo,
      term: text(row, 6),
      translation: text(row, 7),
      example: text(row, 8),
      exampleTranslation: text(row, 9),
      page,
    },
  };
}

function buildUnits(): readonly MahandUnit[] {
  const unitMap = new Map<number, { id: string; number: number; title: string; groups: MahandGroup[]; groupMap: Map<number, MahandGroup> }>();
  for (const raw of RAW_ROWS.split('\n')) {
    if (!raw.trim()) continue;
    const parsed = toItem(raw.split('\t'));
    let unit = unitMap.get(parsed.unitNo);
    if (!unit) {
      unit = {
        id: `mahand-u${String(parsed.unitNo).padStart(2, '0')}`,
        number: parsed.unitNo,
        title: parsed.unitTitle,
        groups: [],
        groupMap: new Map<number, MahandGroup>(),
      };
      unitMap.set(parsed.unitNo, unit);
    }
    let group = unit.groupMap.get(parsed.groupNo);
    if (!group) {
      group = {
        id: `mahand-u${String(parsed.unitNo).padStart(2, '0')}-g${String(parsed.groupNo).padStart(2, '0')}`,
        number: parsed.groupNo,
        title: parsed.groupTitle,
        page: parsed.page,
        items: [],
      };
      unit.groupMap.set(parsed.groupNo, group);
      unit.groups.push(group);
    }
    (group.items as MahandItem[]).push(parsed.item);
  }
  return [...unitMap.values()].map((unit) => ({
    id: unit.id,
    number: unit.number,
    title: unit.title,
    groups: unit.groups,
  }));
}

export const MAHAND_UNITS = buildUnits();
export const MAHAND_STATS = { unitCount: 20, groupCount: 100, itemCount: 1041 } as const;
