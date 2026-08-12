interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hora
const RATE_LIMIT_MAX = 20;

export function rateLimit(request: Request): Response | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const waitMin = Math.ceil((entry.resetAt - now) / 60000);
    return Response.json(
      { error: `Limite de requisições atingido. Tente novamente em ${waitMin} minuto(s).` },
      { status: 429 }
    );
  }

  entry.count++;
  return null;
}
