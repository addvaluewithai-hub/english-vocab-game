import { IMPORT_POLICY } from '@/imports/policy';
import { authorizeImportJob } from '@/server/import-auth';
import { queueServerJobRetry } from '@/server/import-job-control';
import { serverJobSnapshot } from '@/server/import-job-store';

export async function POST(request: Request, { id }: { id: string }): Promise<Response> {
  try {
    const authorized = await authorizeImportJob(request, id);
    const queued = await queueServerJobRetry(
      authorized.ownerId,
      id,
      IMPORT_POLICY.retry.maxAttempts,
    );
    if (!queued) {
      const current = await serverJobSnapshot(authorized.ownerId, id);
      if (!current) return Response.json({ message: 'Import job not found.' }, { status: 404 });
      return Response.json(
        { message: `This import cannot be retried again automatically. The retry limit is ${IMPORT_POLICY.retry.maxAttempts}.`, job: current },
        { status: 409 },
      );
    }
    const snapshot = await serverJobSnapshot(authorized.ownerId, id);
    return snapshot
      ? Response.json(snapshot)
      : Response.json({ message: 'Import job not found.' }, { status: 404 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : '';
    if (message === 'AUTH_REQUIRED') return Response.json({ message: 'Sign in to retry this import.' }, { status: 401 });
    if (message === 'IMPORT_JOB_FORBIDDEN') return Response.json({ message: 'Import job not found.' }, { status: 404 });
    return Response.json({ message: 'Could not reopen this import right now.' }, { status: 502 });
  }
}
