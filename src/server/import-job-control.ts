import { serverSql } from './database';

export async function setServerJobArtifact(input: {
  ownerId: string;
  id: string;
  artifactKey: string;
  expiresAt: string;
}): Promise<void> {
  const sql = serverSql();
  await sql`
    UPDATE import_jobs SET artifact_key=${input.artifactKey}, artifact_expires_at=${input.expiresAt},
      updated_at=${new Date().toISOString()}
    WHERE owner_id=${input.ownerId} AND id=${input.id}
  `;
}

export async function cancelServerJob(ownerId: string, id: string): Promise<void> {
  const sql = serverSql();
  await sql`
    UPDATE import_jobs SET status='CANCELLED', updated_at=${new Date().toISOString()}
    WHERE owner_id=${ownerId} AND id=${id} AND status IN ('QUEUED','PROCESSING','FAILED')
  `;
}

export async function queueServerJobRetry(ownerId: string, id: string, maxRetries = 3): Promise<boolean> {
  const sql = serverSql();
  const rows = await sql`
    UPDATE import_jobs SET status='QUEUED', retry_count=retry_count+1,
      error_code=NULL,error_message=NULL,provider_job_id=NULL,updated_at=${new Date().toISOString()}
    WHERE owner_id=${ownerId} AND id=${id} AND status IN ('FAILED','CANCELLED') AND retry_count < ${maxRetries}
    RETURNING id
  ` as unknown as Array<{ id: string }>;
  return rows.length > 0;
}
