/**
 * Allowlist de providers e modelos de IA permitidos pelo sistema.
 * O frontend NÃO pode enviar providers ou modelos arbitrários.
 * Adicionar novos modelos aqui para que fiquem disponíveis.
 */

export const ALLOWED_PROVIDERS: string[] = ['openrouter'];

export const ALLOWED_MODELS: string[] = [
  'google/gemini-3.1-flash-lite-preview',
  'google/gemini-2.5-flash-preview',
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-haiku',
];

/**
 * Retorna o endpoint da API para um provider.
 *
 * @param provider
 * @returns string
 */
export function getProviderEndpoint(provider: string): string {
  const endpoints: Record<string, string> = {
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  };
  return endpoints[provider] ?? endpoints['openrouter'];
}

/**
 * Valida se provider e model estão na allowlist.
 *
 * @param provider
 * @param model
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateProviderAndModel(
  provider: string,
  model: string
): { valid: boolean; error?: string } {
  if (!ALLOWED_PROVIDERS.includes(provider)) {
    return { valid: false, error: `Provider não suportado: "${provider}".` };
  }

  if (!ALLOWED_MODELS.includes(model)) {
    return { valid: false, error: `Modelo não suportado: "${model}".` };
  }

  return { valid: true };
}
