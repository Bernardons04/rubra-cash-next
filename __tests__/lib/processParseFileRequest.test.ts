import { processParseFileRequest } from '../../src/lib/processParseFileRequest';

// Mock do fetch global (sem chamadas reais à API de IA)
global.fetch = jest.fn();

const aiConfig = { apiKey: 'test-key', model: 'gpt-4', provider: 'openai' };

beforeEach(() => {
  (global.fetch as jest.Mock).mockClear();
});

// ─── Resposta válida com uma transação ────────────────────────────────────────

describe('processParseFileRequest - Resposta válida do provider', () => {
  it('deve extrair e normalizar uma transação simples', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          transactions: [{
            date: '2023-10-01', title: 'Supermercado XYZ',
            amount: -150.25, type: 'expense', category: 'Alimentação',
            subcategory: 'Mercado', method: 'credit_card', direction: null,
            counterpart_account_id: null, counterpart_name_hint: null,
          }],
        }) } }],
      }),
    });

    const res = await processParseFileRequest({ content: 'extrato...', aiConfig });
    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(1);
    const tx = res.body.transactions![0];
    expect(tx.title).toBe('Supermercado XYZ');
    expect(tx.amount).toBe(150.25); // Math.abs aplicado
    expect(tx.type).toBe('expense');
  });

  it('deve extrair múltiplas transações corretamente', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          transactions: [
            { date: '2024-01-01', title: 'Salário', amount: 5000, type: 'income', category: 'Salário', subcategory: 'CLT', method: 'transfer', direction: null, counterpart_account_id: null, counterpart_name_hint: null },
            { date: '2024-01-05', title: 'Uber', amount: 25.50, type: 'expense', category: 'Transporte', subcategory: '', method: 'pix', direction: null, counterpart_account_id: null, counterpart_name_hint: null },
            { date: '2024-01-10', title: 'Transferência', amount: 500, type: 'transfer', category: 'Outros', subcategory: '', method: 'transfer', direction: 'out', counterpart_account_id: null, counterpart_name_hint: null },
          ],
        }) } }],
      }),
    });

    const res = await processParseFileRequest({ content: 'extrato...', aiConfig });
    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(3);
    expect(res.body.transactions!.map(t => t.type)).toEqual(['income', 'expense', 'transfer']);
  });

  it('deve aceitar resposta da IA com blocos markdown (```json)', async () => {
    const jsonContent = JSON.stringify({ transactions: [
      { date: '2024-01-01', title: 'Compra', amount: 50, type: 'expense', category: 'Outros', subcategory: '', method: 'pix', direction: null, counterpart_account_id: null, counterpart_name_hint: null },
    ]});
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: `\`\`\`json\n${jsonContent}\n\`\`\`` } }],
      }),
    });

    const res = await processParseFileRequest({ content: 'extrato...', aiConfig });
    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(1);
  });

  it('deve sanitizar counterpart_account_id inválido para null', async () => {
    const validAccId = '11111111-1111-1111-1111-111111111111';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          transactions: [{
            date: '2024-01-01', title: 'Transferência', amount: 100, type: 'transfer',
            category: 'Outros', subcategory: '', method: 'transfer', direction: 'out',
            counterpart_account_id: 'id-inventado-pela-ia', // ID inválido — não está em accounts[]
            counterpart_name_hint: 'Nubank',
          }],
        }) } }],
      }),
    });

    const res = await processParseFileRequest({ content: 'extrato...', aiConfig, accounts: [] });
    expect(res.status).toBe(200);
    const tx = res.body.transactions![0];
    expect(tx.counterpart_account_id).toBeNull(); // Sanitizado
    expect(tx.counterpart_name_hint).toBe('Nubank'); // Preservado como hint
  });

  it('deve filtrar transações com amount = 0 ou title vazio', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          transactions: [
            { date: '2024-01-01', title: '', amount: 0, type: 'expense', category: 'Outros', subcategory: '', method: 'pix', direction: null, counterpart_account_id: null, counterpart_name_hint: null },
            { date: '2024-01-02', title: 'Válida', amount: 50, type: 'expense', category: 'Outros', subcategory: '', method: 'pix', direction: null, counterpart_account_id: null, counterpart_name_hint: null },
          ],
        }) } }],
      }),
    });

    const res = await processParseFileRequest({ content: 'extrato...', aiConfig });
    expect(res.body.transactions).toHaveLength(1); // Apenas a válida
    expect(res.body.transactions![0].title).toBe('Válida');
  });
});

// ─── Erros do provider ────────────────────────────────────────────────────────

describe('processParseFileRequest - Erros do provider', () => {
  it('deve retornar status 401 quando o provider rejeita a API key', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    });

    const res = await processParseFileRequest({ content: 'extrato...', aiConfig });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Chave de API inválida');
  });

  it('deve retornar 502 quando o provider retorna JSON malformado', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'isso não é json {{{' } }],
      }),
    });

    const res = await processParseFileRequest({ content: 'extrato...', aiConfig });
    expect(res.status).toBe(502);
    expect(res.body.error).toContain('JSON');
  });

  it('deve retornar 502 quando o provider retorna conteúdo vazio', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '' } }] }),
    });

    const res = await processParseFileRequest({ content: 'extrato...', aiConfig });
    expect(res.status).toBe(502);
  });

  it('deve retornar 502 quando o fetch lança uma exceção (rede indisponível)', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network Error'));
    const res = await processParseFileRequest({ content: 'extrato...', aiConfig });
    expect(res.status).toBe(502);
    expect(res.body.error).toContain('Falha ao conectar');
  });
});

// ─── Validações de entrada ────────────────────────────────────────────────────

describe('processParseFileRequest - Validações de entrada', () => {
  it('deve retornar 400 se content estiver vazio', async () => {
    const res = await processParseFileRequest({ content: '', aiConfig });
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('deve retornar 400 se aiConfig não tiver apiKey', async () => {
    const res = await processParseFileRequest({
      content: 'extrato...',
      aiConfig: { apiKey: '', model: 'gpt-4', provider: 'openai' },
    });
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
