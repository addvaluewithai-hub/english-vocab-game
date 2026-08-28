import type { StudySession } from './session';

let activeSession: StudySession | null = null;

export function getActiveStudySession(): StudySession | null {
  return activeSession;
}

export function setActiveStudySession(session: StudySession | null): void {
  activeSession = session;
}
