import { createAuthClient } from '@neondatabase/neon-js/auth';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

type NeonAuthResult = {
  data?: {
    user?: {
      id: string;
      email: string;
      name?: string | null;
    } | null;
  } | null;
  error?: {
    message?: string | null;
  } | null;
};

type NeonAuthClient = {
  signIn: {
    email: (input: { email: string; password: string }) => Promise<NeonAuthResult>;
  };
  signUp: {
    email: (input: { email: string; password: string; name: string }) => Promise<NeonAuthResult>;
  };
  getSession: () => Promise<NeonAuthResult>;
  getJWTToken?: () => Promise<string | null | undefined>;
  signOut: () => Promise<unknown>;
};

let authClient: NeonAuthClient | null = null;
let authClientUrl: string | null = null;

function configuredAuthUrl(): string | null {
  return process.env.EXPO_PUBLIC_NEON_AUTH_URL?.trim() || null;
}

export function isNeonAuthConfigured(): boolean {
  return Boolean(configuredAuthUrl());
}

function getAuthClient(): NeonAuthClient {
  const url = configuredAuthUrl();
  if (!url) throw new Error('Cloud account services are not configured for this build.');
  if (!authClient || authClientUrl !== url) {
    // createAuthClient supports multiple adapter shapes. This application deliberately uses
    // the Neon Auth / Better Auth surface exposed by a Neon Auth URL, so narrow to only the
    // small contract exercised by the app rather than leaking the library's adapter union.
    authClient = createAuthClient(url) as unknown as NeonAuthClient;
    authClientUrl = url;
  }
  return authClient;
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

function authError(result: NeonAuthResult, fallback: string): Error {
  return new Error(result.error?.message?.trim() || fallback);
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthUser> {
  const result = await getAuthClient().signIn.email({
    email: email.trim(),
    password,
  });
  if (result.error) throw authError(result, 'Authentication failed.');
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
  const result = await getAuthClient().signUp.email({
    email: cleanEmail,
    password,
    name: cleanName,
  });
  if (result.error) throw authError(result, 'Account creation failed.');
  if (!result.data?.user) {
    throw new Error('Neon Auth did not return a user after sign up.');
  }
  return userFromNeon(result.data.user);
}

export async function restoreAuthUser(): Promise<AuthUser | null> {
  if (!isNeonAuthConfigured()) return null;
  const result = await getAuthClient().getSession();
  if (result.error || !result.data?.user) return null;
  return userFromNeon(result.data.user);
}

export async function getNeonJwtToken(): Promise<string> {
  if (!isNeonAuthConfigured()) throw new Error('Cloud account services are not configured for this build.');
  const auth = getAuthClient();
  if (!auth.getJWTToken) throw new Error('This Neon Auth client cannot provide a data-access token.');
  const token = await auth.getJWTToken();
  if (!token) throw new Error('Sign in to use cloud-assisted imports.');
  return token;
}

export async function signOutFromNeon(): Promise<void> {
  if (!isNeonAuthConfigured()) return;
  await getAuthClient().signOut();
}
