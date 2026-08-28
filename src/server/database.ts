import { neon } from '@neondatabase/serverless';

export function serverSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('SERVER_DATABASE_NOT_CONFIGURED');
  return neon(url);
}
