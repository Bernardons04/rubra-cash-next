import { handleCors } from '@/lib/cors';

export async function GET(request: Request) {
  const { error, preflight, corsHeaders } = handleCors(request);
  if (error) return error;
  if (preflight) return preflight;

  return new Response('API rodando 🚀', { status: 200, headers: corsHeaders });
}

export async function OPTIONS(request: Request) {
  const { preflight } = handleCors(request);
  return preflight;
}
