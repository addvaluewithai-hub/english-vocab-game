import type { StudySession } from './session';

let activeSession: StudySession | null = null;
let activeLanguagePairId: string | null = null;

export function getActiveStudySession(languagePairId?: string): StudySession | null {
  if (languagePairId && activeLanguagePairId !== languagePairId) return null;
  return activeSession;
}

export function setActiveStudySession(session: StudySession | null, languagePairId?: string | null): void {
  activeSession = session;
  activeLanguagePairId = session ? (languagePairId ?? activeLanguagePairId) : null;
}
