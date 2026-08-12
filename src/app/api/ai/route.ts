import { handleCors } from '@/lib/cors';
import { rateLimit } from '@/lib/rateLimit';
import { processParseFileRequest } from '@/lib/processParseFileRequest';
import { createAuthenticatedClient, extractBearerToken } from '@/lib/supabaseClient';
import { decrypt } from '@/lib/encryption';

export async function POST(request: Request) {
  const { error, preflight, corsHeaders } = handleCors(request);
  if (error) return error;
  if (preflight) return preflight;

  const rateLimitError = rateLimit(request);
  if (rateLimitError) return rateLimitError;

  // 1. Autenticar usuário via JWT
  const token = extractBearerToken(request);
  if (!token) {
    return Response.json(
      { error: 'Autenticação necessária.' },
      { status: 401, headers: corsHeaders }
    );
  }

  // 2. Buscar configurações de IA do usuário no Supabase
  let aiSettings: { provider: string; model: string; encrypted_api_key: string };
  try {
    const supabase = createAuthenticatedClient(token);

    const { data, error: dbError } = await supabase
      .from('user_ai_settings')
      .select('provider, model, encrypted_api_key')
      .single();

    if (dbError || !data) {
      return Response.json(
        { error: 'Configurações de IA não encontradas. Configure sua chave de API nas configurações.' },
        { status: 404, headers: corsHeaders }
      );
    }

    aiSettings = data as { provider: string; model: string; encrypted_api_key: string };
  } catch (err: any) {
    console.error('[AI ROUTE] Erro ao buscar configurações do usuário:', err.message);
    return Response.json(
      { error: 'Erro interno ao carregar configurações de IA.' },
      { status: 500, headers: corsHeaders }
    );
  }

  // 3. Descriptografar a chave — isso ocorre APENAS no servidor
  let apiKey: string;
  try {
    apiKey = decrypt(aiSettings.encrypted_api_key);
  } catch (err: any) {
    console.error('[AI ROUTE] Falha na descriptografia da chave:', err.message);
    return Response.json(
      { error: 'Erro interno ao processar configurações de IA.' },
      { status: 500, headers: corsHeaders }
    );
  }

  // 4. Processar a requisição passando o aiConfig (chave nunca retorna ao frontend)
  const body = await request.json().catch(() => ({}));

  const result = await processParseFileRequest({
    ...body,
    aiConfig: {
      apiKey,
      model: aiSettings.model,
      provider: aiSettings.provider,
    },
  });

  // Garantia: nunca serializar apiKey na resposta
  return Response.json(result.body, { status: result.status, headers: corsHeaders });
}

export async function OPTIONS(request: Request) {
  const { preflight } = handleCors(request);
  return preflight;
}
