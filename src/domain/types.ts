export type EntityId = string;
export type ISODateString = string;

export type TermKind = 'WORD' | 'PHRASE';
export type StudyLifecycle = 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED';
export type ReviewGrade = 'KNEW' | 'FORGOT';
export type ReviewMode = 'TARGET_TO_MEANING' | 'MEANING_TO_TARGET' | 'CLOZE' | 'LISTENING' | 'TYPING';
export type ReviewModeResult = 'SELF_GRADED' | 'CORRECT' | 'INCORRECT';
export type SourceType = 'MANUAL' | 'TEXT' | 'PDF' | 'YOUTUBE' | 'URL' | 'PHOTO' | 'GENERATED';

export interface SyncEntity {
  id: EntityId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  version: number;
  deletedAt: ISODateString | null;
}

export interface LanguagePair extends SyncEntity {
  targetLanguageCode: string;
  targetLanguageName: string;
  referenceLanguageCode: string;
  referenceLanguageName: string;
}

export interface Term extends SyncEntity {
  languagePairId: EntityId;
  text: string;
  normalizedText: string;
  kind: TermKind;
}

export interface Sense extends SyncEntity {
  termId: EntityId;
  translation: string;
  definition: string | null;
  partOfSpeech: string | null;
  note: string | null;
  imageUri: string | null;
  audioUri: string | null;
}

export interface Card extends SyncEntity {
  senseId: EntityId;
  promptMode: 'TARGET_TO_MEANING';
}

export interface Collection extends SyncEntity {
  name: string;
  description: string | null;
}

export interface CollectionItem {
  collectionId: EntityId;
  cardId: EntityId;
  createdAt: ISODateString;
}

export interface Source extends SyncEntity {
  type: SourceType;
  title: string | null;
  externalId: string | null;
  uri: string | null;
}

export interface SourceOccurrence extends SyncEntity {
  sourceId: EntityId;
  senseId: EntityId;
  originalSentence: string | null;
  pageNumber: number | null;
  timestampSeconds: number | null;
  locator: string | null;
}

export interface UserCardState {
  cardId: EntityId;
  lifecycle: StudyLifecycle;
  repetitions: number;
  lapses: number;
  lastReviewedAt: ISODateString | null;
  nextDueAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  version: number;
  stability?: number;
  difficulty?: number;
  elapsedDays?: number;
  scheduledDays?: number;
  learningSteps?: number;
  fsrsState?: number;
  schedulerVersion?: string;
}

export interface ReviewEvent {
  id: EntityId;
  cardId: EntityId;
  sessionId: EntityId;
  grade: ReviewGrade;
  reviewedAt: ISODateString;
  responseMs: number | null;
  recallMode?: ReviewMode;
  modeResult?: ReviewModeResult;
  schedulerRating?: number | null;
}

export interface StudyCard {
  cardId: EntityId;
  termId: EntityId;
  senseId: EntityId;
  targetLanguageCode: string;
  referenceLanguageCode: string;
  term: string;
  termKind: TermKind;
  translation: string;
  definition: string | null;
  partOfSpeech: string | null;
  note: string | null;
  imageUri: string | null;
  audioUri: string | null;
  contextSentence: string | null;
  sourceTitle: string | null;
  sourceType: SourceType | null;
  sourcePageNumber: number | null;
  sourceTimestampSeconds: number | null;
  createdAt: ISODateString;
  state: UserCardState | null;
}
