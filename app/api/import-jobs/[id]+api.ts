import { pollPdfExtraction } from '@/imports/pdf-server';
import { authorizeImportJob } from '@/server/import-auth';
import {
  getServerImportJob,
  markServerJobFailed,
  serverJobSnapshot,
  storeServerCandidates,
} from '@/server/import-job-store';

function safeMessage(code: string): string {
  if (code === 'PDF_SCANNED_UNSUPPORTED') return 'This PDF appears to be scanned. Text PDFs are supported first; photo/OCR import handles images separately.';
  if (code === 'PDF_ENCRYPTED_OR_UNREADABLE') return 'This PDF is encrypted or unreadable. Try an unlocked text PDF.';
  if (code === 'PDF_NO_CANDIDATES') return 'No useful vocabulary candidates were found in this PDF.';
  if (code === 'IMPORT_CANCELLED') return 'Import cancelled.';
  return 'PDF extraction failed. You can retry without losing approved vocabulary.';
}

export async function GET(request: Request, { id }: { id: string }): Promise<Response> {
  try {
    const authorized = await authorizeImportJob(request, id);
    const job = await getServerImportJob(authorized.ownerId, id);
    if (!job) return Response.json({ message: 'Import job not found.' }, { status: 404 });

    if (job.status === 'PROCESSING' && job.providerKind === 'OPENAI_PDF_RESPONSES' && job.providerJobId && job.artifactKey) {
      try {
        const polled = await pollPdfExtraction(job.providerJobId, job.artifactKey);
        if (polled.status === 'COMPLETED' && polled.candidates) {
          await storeServerCandidates({
            ownerId: authorized.ownerId,
            jobId: id,
            candidates: polled.candidates,
            metrics: {
              ...job.metrics,
              candidateCount: polled.candidates.length,
              providerUsage: polled.usage ?? {},
            },
          });
        }
      } catch (caught) {
        const code = caught instanceof Error ? caught.message.split(':')[0] ?? 'PDF_PROCESSING_FAILED' : 'PDF_PROCESSING_FAILED';
        await markServerJobFailed({
          ownerId: authorized.ownerId,
          id,
          code,
          message: safeMessage(code),
          metrics: job.metrics,
        });
      }
    }

    const snapshot = await serverJobSnapshot(authorized.ownerId, id);
    return snapshot ? Response.json(snapshot) : Response.json({ message: 'Import job not found.' }, { status: 404 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : '';
    if (message === 'AUTH_REQUIRED') return Response.json({ message: 'Sign in to view this import.' }, { status: 401 });
    if (message === 'IMPORT_JOB_FORBIDDEN') return Response.json({ message: 'Import job not found.' }, { status: 404 });
    return Response.json({ message: 'Could not refresh this import right now.' }, { status: 502 });
  }
}
