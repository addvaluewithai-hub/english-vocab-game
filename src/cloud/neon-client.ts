import { createClient } from '@neondatabase/neon-js';

function requiredEnv(name: 'EXPO_PUBLIC_NEON_AUTH_URL' | 'EXPO_PUBLIC_NEON_DATA_API_URL'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured for this build.`);
  return value;
}

export function isNeonCloudConfigured(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_NEON_AUTH_URL?.trim()
      && process.env.EXPO_PUBLIC_NEON_DATA_API_URL?.trim(),
  );
}

function createNeonClient() {
  return createClient({
    auth: { url: requiredEnv('EXPO_PUBLIC_NEON_AUTH_URL') },
    dataApi: { url: requiredEnv('EXPO_PUBLIC_NEON_DATA_API_URL') },
  });
}

export type NeonClient = ReturnType<typeof createNeonClient>;

let singleton: NeonClient | null = null;

export function getNeonClient(): NeonClient {
  singleton ??= createNeonClient();
  return singleton;
}
