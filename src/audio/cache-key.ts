const SUPPORTED_EXTENSION = /\.(mp3|m4a|aac|wav|ogg|opus|webm|caf|3gp|amr)$/i;

export function pronunciationCacheKey(uri: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < uri.length; index += 1) {
    hash ^= uri.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function pronunciationFileExtension(uri: string): string {
  try {
    const pathname = new URL(uri).pathname;
    const match = SUPPORTED_EXTENSION.exec(pathname);
    return match?.[0].toLowerCase() ?? '.mp3';
  } catch {
    const clean = uri.split(/[?#]/, 1)[0] ?? uri;
    const match = SUPPORTED_EXTENSION.exec(clean);
    return match?.[0].toLowerCase() ?? '.mp3';
  }
}

export function isLocalAudioUri(uri: string): boolean {
  return /^(file|content|asset):/i.test(uri);
}
