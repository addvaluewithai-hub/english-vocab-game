import { authorizeImportJob } from '@/server/import-auth';
import { serverJobSnapshot } from '@/server/import-job-store';

export async function GET(request: Request, { id }: { id: string }): Promise<Response> {
  try {
    const authorized = await authorizeImportJob(request, id);
    const snapshot = await serverJobSnapshot(authorized.ownerId, id);
    return snapshot
      ? Response.json(snapshot)
      : Response.json({ message: 'Import job not found.' }, { status: 404 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : '';
    if (message === 'AUTH_REQUIRED') return Response.json({ message: 'Sign in to view this import.' }, { status: 401 });
    if (message === 'IMPORT_JOB_FORBIDDEN') return Response.json({ message: 'Import job not found.' }, { status: 404 });
    return Response.json({ message: 'Could not refresh this import right now.' }, { status: 502 });
  }
}
