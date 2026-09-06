import { handleCors } from '@/lib/cors';
import { createAuthenticatedClient, extractBearerToken } from '@/lib/supabaseClient';
import { encrypt } from '@/lib/encryption';

export async function GET(request: Request) {
  const { error, preflight, corsHeaders } = handleCors(request);
  if (error) return error;
  if (preflight) return preflight;

  const token = extractBearerToken(request);
  if (!token) {
    return Response.json({ error: 'Autenticação necessária.' }, { status: 401, headers: corsHeaders });
  }

  try {
    const supabase = createAuthenticatedClient(token);

    const { data, error: dbError } = await supabase
      .from('user_ai_settings')
      .select('provider, model, api_key_last4, created_at')
      .single();

    if (dbError || !data) {
      return Response.json({ configured: false }, { status: 200, headers: corsHeaders });
    }

    return Response.json(
      { configured: true, provider: data.provider, model: data.model, api_key_last4: data.api_key_last4, created_at: data.created_at },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('[AI SETTINGS GET] Erro inesperado:', err.message);
    return Response.json({ error: 'Erro interno.' }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: Request) {
  const { error, preflight, corsHeaders } = handleCors(request);
  if (error) return error;
  if (preflight) return preflight;

  const token = extractBearerToken(request);
  if (!token) {
    return Response.json({ error: 'Autenticação necessária.' }, { status: 401, headers: corsHeaders });
  }

  // 1. Parse do body
  const body = await request.json().catch(() => null);
  if (!body) {
    return Response.json({ error: 'Corpo da requisição inválido.' }, { status: 400, headers: corsHeaders });
  }

  // 2. Sanitização e normalização
  const rawApiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';

  // 3. Validação básica de presença
  if (!rawApiKey) {
    return Response.json(
      { error: 'O campo "api_key" é obrigatório.' },
      { status: 400, headers: corsHeaders }
    );
  }

  // 4. Validação estrutural da api_key (tamanho mínimo — sem chamar o provider)
  if (rawApiKey.length < 20 || rawApiKey.length > 512) {
    return Response.json(
      { error: 'Formato de chave de API inválido.' },
      { status: 400, headers: corsHeaders }
    );
  }

  // 5. Configuração hardcoded de Provider e Model
  const provider = 'openrouter';
  const model = 'google/gemini-2.5-flash';

  // 6. Criptografar a chave — ocorre APENAS no servidor
  let encryptedApiKey: string;
  try {
    encryptedApiKey = encrypt(rawApiKey);
  } catch (err: any) {
    console.error('[AI SETTINGS POST] Falha na criptografia:', err.message);
    return Response.json({ error: 'Erro interno ao processar a chave.' }, { status: 500, headers: corsHeaders });
  }

  // 7. Extrair os últimos 4 caracteres para exibição no frontend
  const apiKeyLast4 = rawApiKey.slice(-4);

  // 8. Upsert no Supabase com o JWT do usuário (RLS garante isolamento)
  try {
    const supabase = createAuthenticatedClient(token);

    const userRes = await supabase.auth.getUser();
    const userId = userRes.data?.user?.id;

    if (!userId) {
      return Response.json({ error: 'Usuário não autenticado.' }, { status: 401, headers: corsHeaders });
    }

    const { error: dbError } = await supabase
      .from('user_ai_settings')
      .upsert(
        {
          user_id: userId,
          provider,
          model,
          encrypted_api_key: encryptedApiKey,
          api_key_last4: apiKeyLast4,
        },
        { onConflict: 'user_id' }
      );

    if (dbError) {
      console.error('[AI SETTINGS POST] Erro ao salvar no banco:', dbError.message);
      return Response.json({ error: 'Erro ao salvar configurações.' }, { status: 500, headers: corsHeaders });
    }

    return Response.json(
      { success: true, provider, model, api_key_last4: apiKeyLast4 },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('[AI SETTINGS POST] Erro inesperado:', err.message);
    return Response.json({ error: 'Erro interno.' }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS(request: Request) {
  const { preflight } = handleCors(request);
  return preflight;
}
