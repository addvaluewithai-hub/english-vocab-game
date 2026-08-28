import { Directory, File, Paths } from 'expo-file-system';
import { isLocalAudioUri, pronunciationCacheKey, pronunciationFileExtension } from './cache-key';

const CACHE_DIR = new Directory(Paths.document, 'pronunciation-audio');
const inFlight = new Map<string, Promise<string>>();

function destinationFor(uri: string): File {
  CACHE_DIR.create({ idempotent: true, intermediates: true });
  return new File(CACHE_DIR, `${pronunciationCacheKey(uri)}${pronunciationFileExtension(uri)}`);
}

async function resolveRemote(uri: string): Promise<string> {
  const destination = destinationFor(uri);
  if (destination.exists && (destination.size ?? 0) > 0) return destination.uri;

  const existing = inFlight.get(uri);
  if (existing) return existing;

  const pending = File.downloadFileAsync(uri, destination, { idempotent: true })
    .then((file) => file.uri)
    .finally(() => {
      inFlight.delete(uri);
    });
  inFlight.set(uri, pending);
  return pending;
}

export async function resolvePronunciationAudioUri(uri: string): Promise<string> {
  const clean = uri.trim();
  if (!clean) throw new Error('Pronunciation audio URL is empty.');
  if (isLocalAudioUri(clean)) return clean;
  if (!/^https?:\/\//i.test(clean)) throw new Error('Unsupported pronunciation audio URL.');
  return resolveRemote(clean);
}

export function cachedPronunciationAudioUri(uri: string): string | null {
  const clean = uri.trim();
  if (!clean) return null;
  if (isLocalAudioUri(clean)) return clean;
  if (!/^https?:\/\//i.test(clean)) return null;
  const destination = destinationFor(clean);
  return destination.exists && (destination.size ?? 0) > 0 ? destination.uri : null;
}
