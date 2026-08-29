import type { A1RawEntry, A1RawGroup } from './raw-types';

const EN_UNDER_20 = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
] as const;
const AR_UNDER_20 = [
  'صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
  'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر',
] as const;
const EN_TENS: Readonly<Record<number, string>> = {
  20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety',
};
const AR_TENS: Readonly<Record<number, string>> = {
  20: 'عشرون', 30: 'ثلاثون', 40: 'أربعون', 50: 'خمسون', 60: 'ستون', 70: 'سبعون', 80: 'ثمانون', 90: 'تسعون',
};

function numberEntry(value: number): A1RawEntry {
  if (value < 20) return { term: EN_UNDER_20[value] ?? String(value), translation: AR_UNDER_20[value] ?? String(value) };
  if (value === 100) return { term: 'one hundred', translation: 'مئة' };
  const tens = Math.floor(value / 10) * 10;
  const ones = value % 10;
  const enTens = EN_TENS[tens] ?? String(tens);
  const arTens = AR_TENS[tens] ?? String(tens);
  if (!ones) return { term: enTens, translation: arTens };
  return {
    term: `${enTens}-${EN_UNDER_20[ones] ?? ones}`,
    translation: `${AR_UNDER_20[ones] ?? ones} و${arTens}`,
  };
}

const ORDINAL_EN = [
  '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
  'twenty-first', 'twenty-second', 'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth', 'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth', 'thirty-first',
] as const;
const ORDINAL_AR = [
  '', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
  'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون',
  'الحادي والعشرون', 'الثاني والعشرون', 'الثالث والعشرون', 'الرابع والعشرون', 'الخامس والعشرون', 'السادس والعشرون', 'السابع والعشرون', 'الثامن والعشرون', 'التاسع والعشرون', 'الثلاثون', 'الحادي والثلاثون',
] as const;

function ordinalEntries(): A1RawEntry[] {
  return Array.from({ length: 31 }, (_, index) => {
    const value = index + 1;
    return { term: ORDINAL_EN[value] ?? String(value), translation: ORDINAL_AR[value] ?? String(value) };
  });
}

export function expandA1Group(group: A1RawGroup): readonly A1RawEntry[] {
  if (group.itemType === 'personalized_slot') return [];
  if (group.id === 'lexical.numbers_zero_to_hundred') {
    return Array.from({ length: 101 }, (_, value) => numberEntry(value));
  }
  if (group.id === 'lexical.ordinal_dates') return ordinalEntries();
  return group.entries;
}
