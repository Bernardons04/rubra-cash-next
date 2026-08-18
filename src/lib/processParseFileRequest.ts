import { getProviderEndpoint } from './aiAllowlist';

export interface ProcessParseFileRequestParams {
  fileName?: string;
  content: string;
  categories?: Record<string, any>;
  notes?: Array<{ title: string; description: string }>;
  userName?: string;
  accounts?: Array<{
    id: string;
    name: string;
    vaults: Array<{ id: string; name: string }>;
  }>;
  max_tokens?: number;
  temperature?: number;
  aiConfig: {
    apiKey: string;
    model: string;
    provider: string;
  };
}

export interface ParsedTransaction {
  date: string;
  title: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  subcategory: string;
  method: 'pix' | 'credit_card' | 'debit_card' | 'boleto' | 'transfer' | 'other';
  direction: 'in' | 'out' | null;
  counterpart_account_id: string | null;
  counterpart_name_hint: string | null;
}

export interface ProcessParseFileResponse {
  status: number;
  body: {
    error?: string;
    transactions?: ParsedTransaction[];
  };
}

export async function processParseFileRequest({
  fileName = '',
  content = '',
  categories = {},
  notes = [],
  userName = '',
  accounts = [],
  max_tokens = 6000,
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
      "direction": "in",
      "counterpart_account_id": "uuid-da-conta-ou-null",
      "counterpart_name_hint": "Nome da origem"
    },
    {
      "date": "YYYY-MM-DD",
      "title": "Salário",
      "amount": 3200.00,
      "type": "income",
      "category": "Salário",
      "subcategory": "CLT",
      "method": "transfer",
      "direction": null,
      "counterpart_account_id": null,
      "counterpart_name_hint": null
    }
  ]
}

Regras de classificação de tipo:
- Use "income" quando o dinheiro ENTRAR na conta vindo de terceiros (outras pessoas, empresas, salário, etc.)
- Use "expense" quando o dinheiro SAIR para terceiros (pagamentos, compras, transferências para outras pessoas)
- Use "transfer" SOMENTE quando a movimentação for entre contas/cofrinhos do PRÓPRIO usuário (listados abaixo)

Sobre o campo "direction" (apenas quando type === "transfer"):
- "out": dinheiro saiu desta conta para a contraparte
- "in": dinheiro entrou nesta conta vindo da contraparte
- Para income e expense: use null

Sobre "counterpart_account_id" (apenas quando type === "transfer"):
- Se a transação no extrato citar o nome de um banco/instituição que seja SIMILAR a um dos nomes das contas do usuário (ex: "NU PAGAMENTOS" -> "Nubank", "ITAU" -> "Itaú", "MERCADO PAGO" -> "Mercado Pago"), ASSOCIE AUTOMATICAMENTE passando o ID daquela conta em "counterpart_account_id".
- Se identificar que é uma transferência entre contas do próprio titular (${userName}), force a classificação como "transfer" e tente associar a conta destino/origem.
- Se não conseguir identificar a conta destino/origem com certeza absoluta, use null e preencha "counterpart_name_hint" com o nome da instituição ou pessoa que aparece no extrato.
- Nunca invente um ID. Se não tiver certeza, deixe null.

Atenção:
- O fato de a transação usar PIX ou TED NÃO a torna automaticamente uma "transfer"
- Transferência para OUTRA PESSOA (não titular) = expense ou income
- Transferência para o PRÓPRIO TITULAR (${userName}) = transfer (tente preencher counterpart_account_id buscando pela instituição citada)
- Se a conta destino/origem for um COFRINHO/VAULT listado, use o ID do cofrinho como counterpart_account_id.

As regras adicionais do usuário têm prioridade sobre toda essa lógica.
`;

  let notesText = '';
  if (Array.isArray(notes) && notes.length > 0) {
    notesText = notes.map(n => `${n.title}: ${n.description}`).join('\n');
  }

  const userContext = `
Contexto do usuário:
- Nome: ${userName || 'Não informado'}
- Contas cadastradas:
${accounts.length > 0 ? accounts.map(a => `  - ${a.name} (ID: ${a.id})${a.vaults?.length ? '\n    Cofrinhos: ' + a.vaults.map(v => `${v.name} (ID: ${v.id})`).join(', ') : ''}`).join('\n') : '  Nenhuma conta cadastrada'}
`;

  const userMessage =
    `Aqui está o conteúdo do extrato:\n\n${content}\n\n` +
    `${userContext}\n` +
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

    const validAccountIds = new Set<string>();
    accounts.forEach(a => {
      validAccountIds.add(a.id);
      a.vaults?.forEach(v => validAccountIds.add(v.id));
    });

    const normalizedTransactions: ParsedTransaction[] = transactions
      .map(tx => {
        let cp_id = tx.counterpart_account_id || null;
        let cp_hint = tx.counterpart_name_hint || null;

        if (cp_id && !validAccountIds.has(cp_id)) {
          if (!cp_hint) cp_hint = cp_id; // Se o ID inventado servir de dica...
          cp_id = null;
        }

        return {
          date: String(tx.date || '').trim(),
          title: String(tx.title || tx.description || '').trim(),
          amount: Math.abs(parseFloat(tx.amount) || 0),
          type: (['income', 'expense', 'transfer'].includes(tx.type) ? tx.type : 'expense') as ParsedTransaction['type'],
          category: String(tx.category || 'Outros').trim(),
          subcategory: String(tx.subcategory || '').trim(),
          method: (['pix', 'credit_card', 'debit_card', 'boleto', 'transfer', 'other'].includes(tx.method)
            ? tx.method : 'other') as ParsedTransaction['method'],
          direction: tx.type === 'transfer' ? (['in', 'out'].includes(tx.direction) ? tx.direction : 'out') : null,
          counterpart_account_id: cp_id,
          counterpart_name_hint: cp_hint,
        };
      })
      .filter(tx => tx.amount > 0 && tx.date && tx.title);

    console.log(`[AI] ${normalizedTransactions.length} transações extraídas com sucesso`);

    return { status: 200, body: { transactions: normalizedTransactions } };

  } catch (err: any) {
    console.error('[PARSE-FILE ERROR]', err.message);
    return { status: 502, body: { error: 'Falha ao conectar com a API de IA.' } };
  }
}
