export type MahandRawItem = readonly [
  wordNo: number,
  term: string,
  translation: string,
  example: string,
  exampleTranslation: string,
];

export type MahandRawGroup = readonly [
  groupNo: number,
  title: string,
  pdfPage: number,
  items: readonly MahandRawItem[],
];

export type MahandRawUnit = readonly [
  unitNo: number,
  title: string,
  groups: readonly MahandRawGroup[],
];
