export type A1RawGroupType = 'lexical_set' | 'frame_set' | 'personalized_slot';

export interface A1RawEntry {
  term: string;
  translation: string;
}

export interface A1RawGroup {
  id: string;
  introductionLocation: string;
  itemType: A1RawGroupType;
  entries: readonly A1RawEntry[];
}

export function parseA1Groups(source: string): A1RawGroup[] {
  return source.trim().split('\n').filter(Boolean).map((line) => {
    const [id, introductionLocation, itemType, termsField, translationsField] = line.split('\t');
    if (!id || !introductionLocation || !itemType || termsField === undefined || translationsField === undefined) {
      throw new Error(`Invalid A1 group row: ${line}`);
    }
    const terms = termsField.split('¦');
    const translations = translationsField.split('¦');
    if (terms.length !== translations.length) {
      throw new Error(`A1 group ${id} has ${terms.length} terms but ${translations.length} translations`);
    }
    return {
      id,
      introductionLocation,
      itemType: itemType as A1RawGroupType,
      entries: terms.map((term, index) => ({ term, translation: translations[index] ?? '' })),
    };
  });
}
