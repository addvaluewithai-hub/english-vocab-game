export interface MahandItem {
  id: string;
  term: string;
  translation: string;
  example: string;
  exampleTranslation: string;
  page: number;
}

export interface MahandGroup {
  id: string;
  number: number;
  title: string;
  items: readonly MahandItem[];
}

export interface MahandUnit {
  id: string;
  number: number;
  title: string;
  groups: readonly MahandGroup[];
}
