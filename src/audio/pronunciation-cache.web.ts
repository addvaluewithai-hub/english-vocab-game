import { isLocalAudioUri } from './cache-key';

function cleanRemoteAudioUri(uri: string): string {
  const clean = uri.trim();
  if (!clean) throw new Error('Pronunciation audio URL is empty.');
  if (isLocalAudioUri(clean)) return clean;
  if (!/^https?:\/\//i.test(clean)) throw new Error('Unsupported pronunciation audio URL.');
  return clean;
}

export async function resolvePronunciationAudioUri(uri: string): Promise<string> {
  return cleanRemoteAudioUri(uri);
}

export function cachedPronunciationAudioUri(uri: string): string | null {
  const clean = uri.trim();
  if (!clean) return null;
  if (isLocalAudioUri(clean)) return clean;
  if (!/^https?:\/\//i.test(clean)) return null;
  return null;
}
