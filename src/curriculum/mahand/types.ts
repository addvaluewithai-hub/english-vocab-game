export interface MahandItem {
  id: string;
  number: number;
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
  page: number;
  items: readonly MahandItem[];
}

export interface MahandUnit {
  id: string;
  number: number;
  title: string;
  groups: readonly MahandGroup[];
}
