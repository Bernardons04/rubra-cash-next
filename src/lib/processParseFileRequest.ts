import { getProviderEndpoint } from './aiAllowlist';

export interface ProcessParseFileRequestParams {
  fileName?: string;
  content: string;
  categories?: Record<string, any>;
  notes?: Array<{ title: string; description: string }>;
  max_tokens?: number;
  temperature?: number;
  aiConfig: {
    apiKey: string;
    model: string;
    provider: string;
  };
}

export interface Transaction {
  date: string;
  title: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  subcategory: string;
  method: 'pix' | 'credit_card' | 'debit_card' | 'boleto' | 'transfer' | 'other';
}

export interface ProcessParseFileResponse {
  status: number;
  body: {
    error?: string;
    transactions?: Transaction[];
  };
}

export async function processParseFileRequest({
  fileName = '',
  content = '',
  categories = {},
  notes = [],
  max_tokens = 20000,
  temperature = 0.0,
  aiConfig,
}: ProcessParseFileRequestParams): Promise<ProcessParseFileResponse> {
  const { apiKey, model, provider } = aiConfig;

  if (!content) {
    return { status: 400, body: { error: 'Campo "content" é obrigatório.' } };
  }

  if (!apiKey || !model || !provider) {
    return { status: 400, body: { error: 'Configurações de IA ausentes. Configure sua chave de API nas configurações.' } };
  }

  const endpoint = getProviderEndpoint(provider);

  console.log(`[AI] Processando extrato (${content.length} caracteres) | Modelo: ${model} | Provider: ${provider}`);

  const mainInstruction = `Você é um especialista em extração de extratos bancários brasileiros. 
Sua tarefa é extrair TODAS as transações financeiras do documento com máxima precisão.
Responda **exclusivamente** com um JSON válido, sem nenhum texto antes ou depois, sem \`\`\`json.`;

  const formatHint = `
Formato EXATO esperado:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "title": "Descrição clara e curta da transação",
      "amount": 123.45,
      "type": "expense",
      "category": "Alimentação",
      "subcategory": "",
      "method": "pix",
      "direction": null
    },
    {
      "date": "YYYY-MM-DD",
      "title": "Transferência recebida",
      "amount": 500.00,
      "type": "transfer",
      "category": "Outros",
      "subcategory": "",
      "method": "transfer",
      "direction": "in"
    },
    {
      "date": "YYYY-MM-DD",
      "title": "Salário",
      "amount": 3200.00,
      "type": "income",
      "category": "Salário",
      "subcategory": "CLT",
      "method": "transfer",
      "direction": null
    }
  ]
}

Regras para o campo "type":
- Use "expense" quando o valor sair da conta (débito, pagamento, compra)
- Use "income" quando o valor entrar na conta (crédito, recebimento, salário)
- Use "transfer" para transferências entre contas

Regras para o campo "direction" (apenas quando type === "transfer"):
- Use "out" se o dinheiro saiu desta conta
- Use "in" se o dinheiro entrou nesta conta
- Para todos os outros tipos, use null

As regras adicionais do usuário têm prioridade sobre toda essa lógica.
`;

  let notesText = '';
  if (Array.isArray(notes) && notes.length > 0) {
    notesText = notes.map(n => `${n.title}: ${n.description}`).join('\n');
  }

  const userMessage =
    `Aqui está o conteúdo do extrato:\n\n${content}\n\n` +
    `Categorias disponíveis: ${JSON.stringify(categories)}\n` +
    `Regras adicionais do usuário:\n${notesText || 'Nenhuma'}\n\n` +
    formatHint;

  const messages = [
    { role: 'system', content: mainInstruction },
    { role: 'user', content: userMessage }
  ];

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://rubra-cash.vercel.app',
        'X-Title': 'Rubra Cash',
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error(`[AI ERROR ${response.status}] Provider: ${provider}, Model: ${model}`);

      if (response.status === 401 || response.status === 403) {
        return {
          status: 401,
          body: { error: 'Chave de API inválida ou sem permissão. Verifique suas configurações de IA.' }
        };
      }

      const safeMessage = typeof errData?.error?.message === 'string'
        ? errData.error.message.substring(0, 200)
        : `Erro do provider de IA (${response.status})`;

      return {
        status: response.status,
        body: { error: safeMessage }
      };
    }

    const data = await response.json();

    let rawContent: string = data.choices?.[0]?.message?.content
      || data.result?.choices?.[0]?.message?.content
      || '';

    if (!rawContent) {
      console.error('[AI] Resposta sem conteúdo:', JSON.stringify(data, null, 2));
      return { status: 502, body: { error: 'A IA não retornou conteúdo' } };
    }

    console.log(`[AI] Resposta recebida - ${rawContent.length} caracteres`);

    rawContent = rawContent
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch (e) {
      console.warn('[AI] JSON.parse falhou. Tentando limpeza extra...');
      rawContent = rawContent.replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
      try {
        parsed = JSON.parse(rawContent);
      } catch (e2) {
        console.error('[AI] Falha crítica no parse do JSON');
        return { status: 502, body: { error: 'IA não retornou JSON válido' } };
      }
    }

    const transactions: any[] = Array.isArray(parsed.transactions) ? parsed.transactions :
      (Array.isArray(parsed) ? parsed : []);

    const normalizedTransactions: Transaction[] = transactions
      .map(tx => ({
        date: String(tx.date || '').trim(),
        title: String(tx.title || tx.description || '').trim(),
        amount: Math.abs(parseFloat(tx.amount) || 0),
        type: (['income', 'expense', 'transfer'].includes(tx.type) ? tx.type : 'expense') as Transaction['type'],
        category: String(tx.category || 'Outros').trim(),
        subcategory: String(tx.subcategory || '').trim(),
        method: (['pix', 'credit_card', 'debit_card', 'boleto', 'transfer', 'other'].includes(tx.method)
          ? tx.method : 'other') as Transaction['method']
      }))
      .filter(tx => tx.amount > 0 && tx.date && tx.title);

    console.log(`[AI] ${normalizedTransactions.length} transações extraídas com sucesso`);

    return { status: 200, body: { transactions: normalizedTransactions } };

  } catch (err: any) {
    console.error('[PARSE-FILE ERROR]', err.message);
    return { status: 502, body: { error: 'Falha ao conectar com a API de IA.' } };
  }
}
