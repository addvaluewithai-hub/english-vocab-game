import { isLocalAudioUri } from './cache-key';

function cleanSupportedUri(uri: string): string {
  const clean = uri.trim();
  if (!clean) throw new Error('Pronunciation audio URL is empty.');
  if (isLocalAudioUri(clean) || /^https?:\/\//i.test(clean)) return clean;
  throw new Error('Unsupported pronunciation audio URL.');
}

export async function resolvePronunciationAudioUri(uri: string): Promise<string> {
  return cleanSupportedUri(uri);
}

export function cachedPronunciationAudioUri(uri: string): string | null {
  try {
    return cleanSupportedUri(uri);
  } catch {
    return null;
  }
}
