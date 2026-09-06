/**
 * @jest-environment jsdom
 *
 * Testes do DataContext verificando que ele:
 * - chama as novas APIs REST (não o Supabase diretamente)
 * - injeta o Authorization: Bearer <token> em todas as chamadas
 * - nunca envia userId no body
 * - processa respostas corretamente
 * - trata HTTP 401 com logout automático
 * - propaga erros HTTP para o chamador
 *
 * Estratégia: mock global do fetch (sem chamadas reais à API).
 */


import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { DataProvider, useData, Transaction, Account, PromptNote } from '../../src/context/DataContext';
import { useUI } from '../../src/context/UIContext';


// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../src/context/UIContext', () => ({
  useUI: jest.fn(),
}));

const mockLogout = jest.fn();
const mockSetToast = jest.fn();

const mockSession = {
  access_token: 'mock-jwt-token-123',
  user: { id: 'user-id-abc' },
};

const getWrapper = () =>
  ({ children }: { children: React.ReactNode }) => (
    <DataProvider>{children}</DataProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  (useUI as jest.Mock).mockReturnValue({
    session: mockSession,
    logout: mockLogout,
    setToast: mockSetToast,
  });
  // Silencia erros esperados
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});


function mockRefreshDataFetch({
  transactions = [] as Transaction[],
  accounts = [] as Account[],
  categories = {} as Record<string, string[]>,
  notes = [] as PromptNote[],
} = {}) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/transactions')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ transactions }) });
    }
    if (url.includes('/api/accounts')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ accounts }) });
    }
    if (url.includes('/api/categories')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ categories }) });
    }
    if (url.includes('/api/notes')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ notes }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

// ─── refreshData ─────────────────────────────────────────────────────────────

describe('DataContext - refreshData', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('deve chamar /api/transactions, /api/accounts, /api/categories e /api/notes', async () => {
    mockRefreshDataFetch();
    renderHook(() => useData(), { wrapper: getWrapper() });

    // Aguarda o useEffect inicial (refreshData ao montar)
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    const urls = (global.fetch as jest.Mock).mock.calls.map(([url]: [string]) => url);
    expect(urls.some(u => u.includes('/api/transactions'))).toBe(true);
    expect(urls.some(u => u.includes('/api/accounts'))).toBe(true);
    expect(urls.some(u => u.includes('/api/categories'))).toBe(true);
    expect(urls.some(u => u.includes('/api/notes'))).toBe(true);
  });

  it('deve incluir Authorization: Bearer <token> em todas as chamadas', async () => {
    mockRefreshDataFetch();
    renderHook(() => useData(), { wrapper: getWrapper() });

    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    for (const call of (global.fetch as jest.Mock).mock.calls) {
      const options = call[1];
      expect(options?.headers?.['Authorization']).toBe(`Bearer ${mockSession.access_token}`);
    }
  });

  it('deve popular transactions, accounts, categories e notes com os dados da API', async () => {
    mockRefreshDataFetch({
      transactions: [{ id: 'tx-1', title: 'Salário', amount: 5000, type: 'income', date: '2024-06-01', category: 'Salário', subcategory: '', method: 'pix', direction: null, accountId: null, counterpartAccountId: null }],
      accounts: [{ id: 'acc-1', name: 'Conta', emoji: '🏦', color: '#000', anchorDate: '2024-01-01', anchorBalance: 0, parentAccountId: null }],
      categories: { Alimentação: ['Mercado'] },
      notes: [{ id: 'note-1', title: 'Regra', description: 'Desc' }],
    });

    const { result } = renderHook(() => useData(), { wrapper: getWrapper() });

    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.accounts).toHaveLength(1);
    expect(result.current.customCategories).toEqual({ Alimentação: ['Mercado'] });
    expect(result.current.aiPromptNotes).toHaveLength(1);
  });

  it('deve chamar logout() quando a API retorna 401', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    renderHook(() => useData(), { wrapper: getWrapper() });

    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    expect(mockLogout).toHaveBeenCalled();
    expect(mockSetToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'warning' })
    );
  });
});

// ─── addTransaction ───────────────────────────────────────────────────────────

describe('DataContext - addTransaction', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    mockRefreshDataFetch();
  });

  it('deve fazer POST /api/transactions com os dados corretos', async () => {
    // Mock especial para o POST
    (global.fetch as jest.Mock).mockImplementation((url: string, options: any) => {
      if (url.includes('/api/transactions') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true, status: 201,
          json: async () => ({ transaction: { id: 'new-id', title: 'Mercado', amount: 150, type: 'expense', date: '2024-06-01', category: 'Alimentação', subcategory: '', method: 'pix', direction: null, accountId: null, counterpartAccountId: null } }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ transactions: [], accounts: [], categories: {}, notes: [] }) });
    });

    const { result } = renderHook(() => useData(), { wrapper: getWrapper() });

    await act(async () => {
      await result.current.addTransaction({
        title: 'Mercado', amount: 150, type: 'expense',
        date: '2024-06-01', category: 'Alimentação',
        subcategory: '', method: 'pix', direction: null,
        accountId: null, counterpartAccountId: null,
      });
    });

    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url, options]: [string, any]) => url.includes('/api/transactions') && options?.method === 'POST'
    );

    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall[1].body);
    expect(body.title).toBe('Mercado');
    expect(body).not.toHaveProperty('user_id'); // userId nunca deve estar no body
    expect(postCall[1].headers['Authorization']).toBe(`Bearer ${mockSession.access_token}`);
  });
});

// ─── deleteTransaction ────────────────────────────────────────────────────────

describe('DataContext - deleteTransaction', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('deve fazer DELETE /api/transactions/:id com o token correto', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, options: any) => {
      if (url.includes('/api/transactions/tx-123') && options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, status: 204, json: async () => null });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ transactions: [], accounts: [], categories: {}, notes: [] }) });
    });

    const { result } = renderHook(() => useData(), { wrapper: getWrapper() });

    await act(async () => {
      await result.current.deleteTransaction('tx-123');
    });

    const deleteCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url, options]: [string, any]) => url.includes('/api/transactions/tx-123') && options?.method === 'DELETE'
    );

    expect(deleteCall).toBeDefined();
    expect(deleteCall[1].headers['Authorization']).toBe(`Bearer ${mockSession.access_token}`);
  });
});

// ─── saveCustomCategories ─────────────────────────────────────────────────────

describe('DataContext - saveCustomCategories', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('deve fazer PUT /api/categories com o body correto', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, options: any) => {
      if (url.includes('/api/categories') && options?.method === 'PUT') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ categories: { Alimentação: ['Mercado'] } }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ transactions: [], accounts: [], categories: {}, notes: [] }) });
    });

    const { result } = renderHook(() => useData(), { wrapper: getWrapper() });

    await act(async () => {
      await result.current.saveCustomCategories({ Alimentação: ['Mercado'] });
    });

    const putCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url, options]: [string, any]) => url.includes('/api/categories') && options?.method === 'PUT'
    );

    expect(putCall).toBeDefined();
    const body = JSON.parse(putCall[1].body);
    expect(body).toEqual({ Alimentação: ['Mercado'] });
    expect(body).not.toHaveProperty('user_id');
  });
});

// ─── Erro de API propagado ────────────────────────────────────────────────────

describe('DataContext - propagação de erros', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('deve propagar erro ao chamar addTransaction quando a API retorna erro 500', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Erro interno no servidor.' }),
    });

    const { result } = renderHook(() => useData(), { wrapper: getWrapper() });

    await expect(
      act(async () => {
        await result.current.addTransaction({
          title: 'Tx', amount: 100, type: 'expense',
          date: '2024-06-01', category: 'Outros',
          subcategory: '', method: 'pix', direction: null,
          accountId: null, counterpartAccountId: null,
        });
      })
    ).rejects.toThrow();
  });
});
