import { describe, expect, it } from 'vitest';
import {
  A1_CATALOG_STATS,
  CURRICULUM_PACKAGES,
  CURRICULUM_UNITS,
  curriculumSelectionKey,
  filterCurriculumPackages,
} from '@/curriculum/catalog';
import { A1_RAW_GROUPS } from '@/curriculum/a1/source';

describe('curriculum catalog', () => {
  it('matches the locked A1 source inventory exactly', () => {
    expect(A1_CATALOG_STATS.groupCount).toBe(104);
    expect(A1_CATALOG_STATS.rawMemberCount).toBe(923);
    expect(A1_CATALOG_STATS.distinctMemberCount).toBe(760);
    expect(A1_RAW_GROUPS).toHaveLength(104);
    expect(A1_RAW_GROUPS.every((group) => group.entries.every((entry) => entry.term.trim() && entry.translation.trim()))).toBe(true);
  });

  it('ships all six worlds and all 45 A1 missions', () => {
    expect(CURRICULUM_UNITS).toHaveLength(6);
    expect(CURRICULUM_PACKAGES).toHaveLength(45);
    expect(CURRICULUM_PACKAGES.map((pkg) => pkg.sequence)).toEqual(Array.from({ length: 45 }, (_, index) => index + 1));
    expect(new Set(CURRICULUM_PACKAGES.map((pkg) => pkg.lessonId)).size).toBe(45);
    expect(CURRICULUM_PACKAGES.every((pkg) => pkg.level === 'A1' && pkg.items.length > 0)).toBe(true);
  });

  it('assigns every source skill set to at least one mission', () => {
    const assigned = new Set(CURRICULUM_PACKAGES.flatMap((pkg) => pkg.sourceGroupIds));
    expect(A1_RAW_GROUPS.every((group) => assigned.has(group.id))).toBe(true);
  });

  it('keeps every selectable study card bilingual with stable selection keys', () => {
    const keys = CURRICULUM_PACKAGES.flatMap((pkg) => pkg.items.map((item) => curriculumSelectionKey(pkg.id, item.id)));
    expect(new Set(keys).size).toBe(keys.length);
    expect(CURRICULUM_PACKAGES.every((pkg) => pkg.items.every((item) => item.term.trim() && item.translation.trim()))).toBe(true);
  });

  it('expands number and ordinal ranges into useful study cards', () => {
    const contact = CURRICULUM_PACKAGES.find((pkg) => pkg.lessonId === 'U1-L05');
    const dates = CURRICULUM_PACKAGES.find((pkg) => pkg.lessonId === 'U2-L09');
    expect(contact?.items.some((item) => item.term === 'zero' && item.translation === 'صفر')).toBe(true);
    expect(contact?.items.some((item) => item.term === 'ninety-nine')).toBe(true);
    expect(contact?.items.some((item) => item.term === 'one hundred' && item.translation === 'مئة')).toBe(true);
    expect(dates?.items.some((item) => item.term === 'thirty-first' && item.translation === 'الحادي والثلاثون')).toBe(true);
  });

  it('keeps the personalized country/nationality slot as a prompt, not a fake card', () => {
    const introduction = CURRICULUM_PACKAGES.find((pkg) => pkg.lessonId === 'U1-L03');
    expect(introduction?.sourceGroupIds).toContain('lexical.own_country_nationality');
    expect(introduction?.personalizationPrompt?.sourceLexicalItemId).toBe('lexical.own_country_nationality');
    expect(introduction?.items.some((item) => item.term === "the learner's country name")).toBe(false);
  });

  it('filters missions by world and content type', () => {
    const unitId = 'a1.unit04.places_routes_travel';
    const results = filterCurriculumPackages({ level: 'A1', unitId, kind: 'PHRASE', query: '' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((pkg) => pkg.unitId === unitId)).toBe(true);
    expect(results.every((pkg) => pkg.items.every((item) => item.kind === 'PHRASE'))).toBe(true);
  });

  it('searches mission titles, English terms, and Arabic meanings', () => {
    const mission = filterCurriculumPackages({ level: 'A1', unitId: 'ALL', kind: 'ALL', query: 'hotel' });
    const english = filterCurriculumPackages({ level: 'A1', unitId: 'ALL', kind: 'ALL', query: 'booking' });
    const arabic = filterCurriculumPackages({ level: 'A1', unitId: 'ALL', kind: 'ALL', query: 'تذكرة' });
    expect(mission.some((pkg) => pkg.title.toLocaleLowerCase().includes('hotel') || pkg.items.some((item) => item.term.toLocaleLowerCase().includes('hotel')))).toBe(true);
    expect(english.some((pkg) => pkg.items.some((item) => item.term.toLocaleLowerCase().includes('booking')))).toBe(true);
    expect(arabic.some((pkg) => pkg.items.some((item) => item.translation.includes('تذكرة')))).toBe(true);
  });
});
