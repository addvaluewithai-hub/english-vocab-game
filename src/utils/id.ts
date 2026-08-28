let fallbackCounter = 0;

export function createId(prefix: string): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoApi?.randomUUID) return `${prefix}-${cryptoApi.randomUUID()}`;
  fallbackCounter += 1;
  return `${prefix}-${Date.now()}-${fallbackCounter}`;
}
