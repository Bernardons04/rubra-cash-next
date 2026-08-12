const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';

export function getCorsHeaders(origin: string | null): Record<string, string> | null {
  if (!origin) return buildHeaders('*');
  if (ALLOWED_ORIGINS === '*') return buildHeaders('*');

  const allowed = ALLOWED_ORIGINS.split(',').map(o => o.trim());
  if (allowed.includes(origin)) return buildHeaders(origin);

  return null; // origem bloqueada
}

function buildHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function handleCors(request: Request): {
  error?: Response;
  preflight?: Response;
  corsHeaders?: Record<string, string>;
} {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (!corsHeaders) {
    return {
      error: Response.json({ error: `Origem não permitida: ${origin}` }, { status: 403 })
    };
  }

  // Preflight
  if (request.method === 'OPTIONS') {
    return {
      preflight: new Response(null, { status: 204, headers: corsHeaders })
    };
  }

  return { corsHeaders };
}
