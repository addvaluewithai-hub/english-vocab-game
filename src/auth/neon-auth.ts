import { createAuthClient } from '@neondatabase/auth';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

type AuthResult = {
  data?: { user?: { id?: string; email?: string; name?: string | null } } | null;
  error?: { message?: string } | null;
};

let client: ReturnType<typeof createAuthClient> | null = null;

function authUrl(): string {
  const value = process.env.EXPO_PUBLIC_NEON_AUTH_URL?.trim();
  if (!value) throw new Error('Neon Auth is not configured for this build. Guest study still works offline.');
  return value;
}

function getClient() {
  client ??= createAuthClient(authUrl());
  return client;
}

function userFrom(result: AuthResult): AuthUser {
  if (result.error?.message) throw new Error(result.error.message);
  const user = result.data?.user;
  if (!user?.id || !user.email) throw new Error('Neon Auth did not return a usable user session.');
  return { id: user.id, email: user.email, name: user.name ?? null };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  const result = await getClient().signIn.email({ email: email.trim(), password }) as AuthResult;
  return userFrom(result);
}

export async function signUpWithEmail(email: string, password: string, name: string): Promise<AuthUser> {
  const result = await getClient().signUp.email({ email: email.trim(), password, name: name.trim() || email.trim() }) as AuthResult;
  return userFrom(result);
}

export async function restoreAuthUser(): Promise<AuthUser | null> {
  if (!process.env.EXPO_PUBLIC_NEON_AUTH_URL?.trim()) return null;
  const result = await getClient().getSession() as AuthResult;
  if (result.error) return null;
  if (!result.data?.user?.id || !result.data.user.email) return null;
  return { id: result.data.user.id, email: result.data.user.email, name: result.data.user.name ?? null };
}

export async function signOutFromNeon(): Promise<void> {
  if (!process.env.EXPO_PUBLIC_NEON_AUTH_URL?.trim()) return;
  await getClient().signOut();
}
