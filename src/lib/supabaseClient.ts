import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Cria um cliente Supabase autenticado com o JWT do usuário.
 * O RLS do Supabase garante que o usuário só acessa seus próprios dados.
 *
 * @param userJwt - Token JWT extraído do header Authorization
 * @returns SupabaseClient
 */
export function createAuthenticatedClient(userJwt: string): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('[supabase] Variáveis NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não definidas.');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${userJwt}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Extrai e valida o JWT Bearer do cabeçalho Authorization.
 * Retorna null se o header estiver ausente ou malformado.
 *
 * @param request - Request do Next.js ou nativo
 * @returns string | null
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
