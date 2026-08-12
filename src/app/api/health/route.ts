import { handleCors } from '@/lib/cors';
import { ALLOWED_PROVIDERS, ALLOWED_MODELS } from '@/lib/aiAllowlist';

export async function GET(request: Request) {
  const { error, preflight, corsHeaders } = handleCors(request);
  if (error) return error;
  if (preflight) return preflight;

  return Response.json(
    {
      ok: true,
      architecture: 'per-user-ai-config',
      allowed_providers: ALLOWED_PROVIDERS,
      allowed_models: ALLOWED_MODELS,
    },
    { status: 200, headers: corsHeaders }
  );
}

export async function OPTIONS(request: Request) {
  const { preflight } = handleCors(request);
  return preflight;
}
