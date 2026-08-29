import { IMPORT_POLICY } from './policy';

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;

export interface NormalizedYouTubeSource {
  videoId: string;
  canonicalUrl: string;
  fingerprint: string;
}

function videoIdFromUrl(url: URL): string | null {
  const host = url.hostname.toLocaleLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be') {
    return url.pathname.split('/').filter(Boolean)[0] ?? null;
  }
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) return null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const segments = url.pathname.split('/').filter(Boolean);
  if (['shorts', 'live', 'embed'].includes(segments[0] ?? '')) return segments[1] ?? null;
  return null;
}

export function normalizeYouTubeUrl(value: string): NormalizedYouTubeSource {
  const raw = value.trim();
  if (!raw) throw new Error('Paste a YouTube URL first.');
  if (raw.length > IMPORT_POLICY.youtube.maxUrlCharacters) throw new Error('YouTube URL exceeds the supported length limit.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Enter a valid YouTube URL.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Enter a valid YouTube URL.');
  const videoId = videoIdFromUrl(url)?.trim() ?? '';
  if (!VIDEO_ID_PATTERN.test(videoId)) throw new Error('This YouTube link does not contain a supported video ID.');
  const canonicalUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  return {
    videoId,
    canonicalUrl,
    fingerprint: `youtube:${videoId}`,
  };
}
