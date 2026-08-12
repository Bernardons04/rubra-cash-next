import { handleCors } from '@/lib/cors';
import { rateLimit } from '@/lib/rateLimit';
import { processParseFileRequest } from '@/lib/processParseFileRequest';

export async function POST(request: Request) {
  const { error, preflight, corsHeaders } = handleCors(request);
  if (error) return error;
  if (preflight) return preflight;

  const rateLimitError = rateLimit(request);
  if (rateLimitError) return rateLimitError;

  const body = await request.json().catch(() => ({}));
  const result = await processParseFileRequest(body);

  return Response.json(result.body, { status: result.status, headers: corsHeaders });
}

export async function OPTIONS(request: Request) {
  const { preflight } = handleCors(request);
  return preflight;
}
