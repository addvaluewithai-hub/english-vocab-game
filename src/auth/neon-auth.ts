import { createAuthClient } from '@neondatabase/auth';

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
  return createAuthClient(authUrl());
}

type NeonAuthClient = ReturnType<typeof createClient>;
let client: NeonAuthClient | null = null;

function getClient(): NeonAuthClient {
  client ??= createClient();
  return client;
}

function userFromNeon(user: {
  id: string;
  email: string;
  name?: string | null;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name?.trim() || null,
  };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthUser> {
  const result = await getClient().signIn.email({
    email: email.trim(),
    password,
  });
  if (result.error) throw new Error(result.error.message);
  if (!result.data?.user) {
    throw new Error('Neon Auth did not return a user after sign in.');
  }
  return userFromNeon(result.data.user);
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
): Promise<AuthUser> {
  const cleanEmail = email.trim();
  const cleanName = name.trim() || cleanEmail;
  const result = await getClient().signUp.email({
    email: cleanEmail,
    password,
    name: cleanName,
  });
  if (result.error) throw new Error(result.error.message);
  if (!result.data?.user) {
    throw new Error('Neon Auth did not return a user after sign up.');
  }
  return userFromNeon(result.data.user);
}

export async function restoreAuthUser(): Promise<AuthUser | null> {
  if (!process.env.EXPO_PUBLIC_NEON_AUTH_URL?.trim()) return null;

  const result = await getClient().getSession();
  if (result.error || !result.data?.user) return null;
  return userFromNeon(result.data.user);
}

export async function signOutFromNeon(): Promise<void> {
  if (!process.env.EXPO_PUBLIC_NEON_AUTH_URL?.trim()) return;
  await getClient().signOut();
}
