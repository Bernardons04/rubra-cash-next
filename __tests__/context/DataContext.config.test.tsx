/**
 * @jest-environment jsdom
 *
 * Testes do DataContext para operações de configuração:

 * accounts, categorias e notas — usando mock de fetch.
 */

import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { DataProvider, useData } from '../../src/context/DataContext';
import { useUI } from '../../src/context/UIContext';

jest.mock('../../src/context/UIContext', () => ({
  useUI: jest.fn(),
}));

const mockLogout = jest.fn();
const mockSetToast = jest.fn();
const mockSession = {
  access_token: 'mock-jwt-token-config',
  user: { id: 'user-config-id' },
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
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

function mockAllGetOk() {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/transactions')) return Promise.resolve({ ok: true, status: 200, json: async () => ({ transactions: [] }) });
    if (url.includes('/api/accounts')) return Promise.resolve({ ok: true, status: 200, json: async () => ({ accounts: [] }) });
    if (url.includes('/api/categories')) return Promise.resolve({ ok: true, status: 200, json: async () => ({ categories: {} }) });
    if (url.includes('/api/notes')) return Promise.resolve({ ok: true, status: 200, json: async () => ({ notes: [] }) });
    if (url.includes('/api/user/ai-settings')) return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

// ─── addAccount ───────────────────────────────────────────────────────────────

describe('DataContext - addAccount', () => {
  it('deve fazer POST /api/accounts sem enviar user_id no body', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, options: any) => {
      if (url.includes('/api/accounts') && options?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 201, json: async () => ({ account: { id: 'acc-1', name: 'Conta', emoji: '🏦', color: '#000', anchorDate: '2024-01-01', anchorBalance: 0, parentAccountId: null } }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ transactions: [], accounts: [], categories: {}, notes: [] }) });
    });

    const { result } = renderHook(() => useData(), { wrapper: getWrapper() });

    await act(async () => {
      await result.current.addAccount({ name: 'Conta', emoji: '🏦', color: '#000', anchorDate: '2024-01-01', anchorBalance: 0, parentAccountId: null });
    });

    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url, options]: [string, any]) => url.includes('/api/accounts') && options?.method === 'POST'
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall[1].body);
    expect(body).not.toHaveProperty('user_id');
    expect(body.name).toBe('Conta');
  });

  it('deve incluir Authorization: Bearer token no POST /api/accounts', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, options: any) => {
      if (url.includes('/api/accounts') && options?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 201, json: async () => ({ account: {} }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ transactions: [], accounts: [], categories: {}, notes: [] }) });
    });

    const { result } = renderHook(() => useData(), { wrapper: getWrapper() });

    await act(async () => {
      await result.current.addAccount({ name: 'X', emoji: '', color: '', anchorDate: '', anchorBalance: 0, parentAccountId: null });
    });

    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url, options]: [string, any]) => url.includes('/api/accounts') && options?.method === 'POST'
    );
    expect(postCall[1].headers['Authorization']).toBe(`Bearer ${mockSession.access_token}`);
  });
});

// ─── deleteAccount ────────────────────────────────────────────────────────────

describe('DataContext - deleteAccount', () => {
  it('deve fazer DELETE /api/accounts/:id com token correto', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, options: any) => {
      if (url.includes('/api/accounts/acc-del') && options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, status: 204, json: async () => null });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ transactions: [], accounts: [], categories: {}, notes: [] }) });
    });

    const { result } = renderHook(() => useData(), { wrapper: getWrapper() });

    await act(async () => {
      await result.current.deleteAccount('acc-del');
    });

    const deleteCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url, options]: [string, any]) => url.includes('/api/accounts/acc-del') && options?.method === 'DELETE'
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall[1].headers['Authorization']).toBe(`Bearer ${mockSession.access_token}`);
  });
});

// ─── addPromptNote ────────────────────────────────────────────────────────────

describe('DataContext - addPromptNote', () => {
  it('deve fazer POST /api/notes sem enviar user_id', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, options: any) => {
      if (url.includes('/api/notes') && options?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 201, json: async () => ({ note: { id: 'n-1', title: 'Nota', description: 'Desc' } }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ transactions: [], accounts: [], categories: {}, notes: [] }) });
    });

    const { result } = renderHook(() => useData(), { wrapper: getWrapper() });

    await act(async () => {
      await result.current.addPromptNote({ title: 'Nota', description: 'Desc' });
    });

    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url, options]: [string, any]) => url.includes('/api/notes') && options?.method === 'POST'
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall[1].body);
    expect(body.title).toBe('Nota');
    expect(body).not.toHaveProperty('user_id');
  });
});

// ─── saveTransactionsBatch ────────────────────────────────────────────────────

describe('DataContext - saveTransactionsBatch', () => {
  it('deve fazer POST /api/transactions/batch com o formato correto', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, options: any) => {
      if (url.includes('/api/transactions/batch') && options?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 201, json: async () => ({ success: true }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ transactions: [], accounts: [], categories: {}, notes: [] }) });
    });

    const { result } = renderHook(() => useData(), { wrapper: getWrapper() });

    const txs = [{ title: 'Mercado', amount: 100, type: 'expense' as const, date: '2024-06-01', category: 'Alimentação', subcategory: '', method: 'pix', direction: null as null, accountId: null, counterpartAccountId: null }];
    const meta = { name: 'extrato.pdf', type: 'pdf', raw_text: '' };

    await act(async () => {
      await result.current.saveTransactionsBatch(txs, meta);
    });

    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url, options]: [string, any]) => url.includes('/api/transactions/batch') && options?.method === 'POST'
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall[1].body);
    expect(body).toHaveProperty('metadata');
    expect(body).toHaveProperty('transactions');
    expect(body.transactions[0]).not.toHaveProperty('user_id');
    expect(body.metadata.name).toBe('extrato.pdf');
  });
});
