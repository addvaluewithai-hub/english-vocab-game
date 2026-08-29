import { describe, expect, it } from 'vitest';
import {
  CURRICULUM_PACKAGES,
  CURRICULUM_UNITS,
  curriculumSelectionKey,
  filterCurriculumPackages,
} from '@/curriculum/catalog';

describe('curriculum catalog', () => {
  it('ships a structured A1 catalog across all six locked units', () => {
    expect(CURRICULUM_UNITS).toHaveLength(6);
    expect(CURRICULUM_PACKAGES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(CURRICULUM_PACKAGES.map((pkg) => pkg.id)).size).toBe(CURRICULUM_PACKAGES.length);

    const keys = CURRICULUM_PACKAGES.flatMap((pkg) => pkg.items.map((item) => curriculumSelectionKey(pkg.id, item.id)));
    expect(new Set(keys).size).toBe(keys.length);
    expect(CURRICULUM_PACKAGES.every((pkg) => pkg.level === 'A1' && pkg.dialogue.length > 0)).toBe(true);
    expect(CURRICULUM_PACKAGES.every((pkg) => pkg.items.every((item) => item.term.trim() && item.translation.trim()))).toBe(true);
  });

  it('filters packages by unit and content type', () => {
    const unitId = 'a1.unit04.places_routes_travel';
    const results = filterCurriculumPackages({ level: 'A1', unitId, kind: 'PHRASE', query: '' });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((pkg) => pkg.unitId === unitId)).toBe(true);
    expect(results.every((pkg) => pkg.items.every((item) => item.kind === 'PHRASE'))).toBe(true);
  });

  it('searches English terms and Arabic meanings without flattening the package context', () => {
    const english = filterCurriculumPackages({ level: 'A1', unitId: 'ALL', kind: 'ALL', query: 'booking' });
    const arabic = filterCurriculumPackages({ level: 'A1', unitId: 'ALL', kind: 'ALL', query: 'تذكرة' });

    expect(english.some((pkg) => pkg.items.some((item) => item.term.toLocaleLowerCase().includes('booking')))).toBe(true);
    expect(arabic.some((pkg) => pkg.items.some((item) => item.translation.includes('تذكرة')))).toBe(true);
    expect(english.every((pkg) => pkg.unitTitle && pkg.title)).toBe(true);
  });
});
