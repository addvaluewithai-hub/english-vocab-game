import { createAuthClient, SupabaseAuthAdapter } from '@neondatabase/auth';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

function authUrl(): string {
  const value = process.env.EXPO_PUBLIC_NEON_AUTH_URL?.trim();
  if (!value) {
    throw new Error(
      'Neon Auth is not configured for this build. Guest study still works offline.',
    );
  }
  return value;
}

function createClient() {
  return createAuthClient(authUrl(), {
    adapter: SupabaseAuthAdapter(),
  });
}

type NeonAuthClient = ReturnType<typeof createClient>;
let client: NeonAuthClient | null = null;

function getClient(): NeonAuthClient {
  client ??= createClient();
  return client;
}

function userFromSupabase(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): AuthUser {
  if (!user.email) {
    throw new Error('Neon Auth did not return a usable user session.');
  }

  const metadataName = user.user_metadata?.name;
  return {
    id: user.id,
    email: user.email,
    name: typeof metadataName === 'string' && metadataName.trim() ? metadataName : null,
  };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthUser> {
  const { data, error } = await getClient().signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Neon Auth did not return a user after sign in.');
  return userFromSupabase(data.user);
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
): Promise<AuthUser> {
  const cleanEmail = email.trim();
  const cleanName = name.trim() || cleanEmail;
  const { data, error } = await getClient().signUp({
    email: cleanEmail,
    password,
    options: { data: { name: cleanName } },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Neon Auth did not return a user after sign up.');
  return userFromSupabase(data.user);
}

export async function restoreAuthUser(): Promise<AuthUser | null> {
  if (!process.env.EXPO_PUBLIC_NEON_AUTH_URL?.trim()) return null;

  const { data, error } = await getClient().getUser();
  if (error || !data.user) return null;
  return userFromSupabase(data.user);
}

export async function signOutFromNeon(): Promise<void> {
  if (!process.env.EXPO_PUBLIC_NEON_AUTH_URL?.trim()) return;
  const { error } = await getClient().signOut();
  if (error) throw new Error(error.message);
}
