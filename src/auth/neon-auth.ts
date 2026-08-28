import { getNeonClient, isNeonCloudConfigured } from '@/cloud/neon-client';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
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
  const result = await getNeonClient().auth.signIn.email({
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
  const result = await getNeonClient().auth.signUp.email({
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
  if (!isNeonCloudConfigured()) return null;
  const result = await getNeonClient().auth.getSession();
  if (result.error || !result.data?.user) return null;
  return userFromNeon(result.data.user);
}

export async function getNeonJwtToken(): Promise<string> {
  if (!isNeonCloudConfigured()) throw new Error('Cloud account services are not configured for this build.');
  const auth = getNeonClient().auth as typeof getNeonClient extends never
    ? never
    : { getJWTToken?: () => Promise<string | null | undefined> };
  if (!auth.getJWTToken) throw new Error('This Neon Auth client cannot provide a data-access token.');
  const token = await auth.getJWTToken();
  if (!token) throw new Error('Sign in to use cloud-assisted imports.');
  return token;
}

export async function signOutFromNeon(): Promise<void> {
  if (!isNeonCloudConfigured()) return;
  await getNeonClient().auth.signOut();
}
