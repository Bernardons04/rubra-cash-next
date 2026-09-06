'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useUI } from './UIContext';

export interface Transaction {
  id: string;
  date: string;
  title: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  subcategory: string;
  method: string;
  direction: 'in' | 'out' | null;
  accountId: string | null;
  counterpartAccountId: string | null;
}

export interface Account {
  id: string;
  name: string;
  emoji: string;
  color: string;
  anchorDate: string;
  anchorBalance: number;
  parentAccountId: string | null;
}

export interface PromptNote {
  id: string;
  title: string;
  description: string;
}

export interface AISettings {
  provider: string;
  model: string;
  api_key_last4: string | null;
}

interface DataContextProps {
  transactions: Transaction[];
  accounts: Account[];
  customCategories: Record<string, string[]>;
  aiPromptNotes: PromptNote[];
  aiSettings: AISettings | null;
  loadingData: boolean;
  refreshData: () => Promise<void>;
  refreshAISettings: () => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'id'> & { id?: string }) => Promise<void>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteTransactionsBatch: (ids: string[]) => Promise<void>;
  saveTransactionsBatch: (txs: Omit<Transaction, 'id'>[], batchMetadata: { name: string; type: string; raw_text: string }) => Promise<void>;
  addAccount: (acc: Omit<Account, 'id'>) => Promise<void>;
  updateAccount: (acc: Account) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  saveCustomCategories: (categories: Record<string, string[]>) => Promise<void>;
  addPromptNote: (note: Omit<PromptNote, 'id'>) => Promise<void>;
  deletePromptNote: (id: string) => Promise<void>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  setCustomCategories: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  setAiPromptNotes: React.Dispatch<React.SetStateAction<PromptNote[]>>;
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { session, logout, setToast } = useUI();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customCategories, setCustomCategories] = useState<Record<string, string[]>>({});
  const [aiPromptNotes, setAiPromptNotes] = useState<PromptNote[]>([]);
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  /**
   * Helper para chamadas à API autenticada.
   * Injeta o token Bearer e trata erros globais (ex: 401 Unauthorized).
   */
  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    if (!session?.access_token) {
      throw new Error('Usuário não autenticado.');
    }

    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...options.headers,
      },
    });

    if (res.status === 401) {
      setToast({ message: 'Sua sessão expirou. Por favor, faça login novamente.', type: 'warning' });
      logout();
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro HTTP: ${res.status}`);
    }

    // Retorna null para status 204 (No Content)
    if (res.status === 204) return null;

    return res.json();
  };

  const refreshData = async () => {
    if (!session?.access_token) return;

    try {
      const [txRes, accRes, catRes, notesRes] = await Promise.all([
        apiFetch('/api/transactions'),
        apiFetch('/api/accounts'),
        apiFetch('/api/categories'),
        apiFetch('/api/notes'),
      ]);

      setTransactions(txRes.transactions || []);
      setAccounts(accRes.accounts || []);
      setCustomCategories(catRes.categories || {});
      setAiPromptNotes(notesRes.notes || []);
    } catch (err: any) {
      console.error('Error refreshing data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const refreshAISettings = async () => {
    if (!session?.access_token) return;
    try {
      // O endpoint original ai-settings já espera o token
      const res = await fetch(`/api/user/ai-settings`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.status === 404) {
        setAiSettings(null);
        return;
      }
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setAiSettings({
        provider: data.provider,
        model: data.model,
        api_key_last4: data.api_key_last4 || null,
      });
    } catch (err) {
      console.warn('Error fetching AI settings:', err);
    }
  };

  useEffect(() => {
    if (session) {
      setLoadingData(true);
      refreshData();
      refreshAISettings();
    } else {
      setTransactions([]);
      setAccounts([]);
      setCustomCategories({});
      setAiPromptNotes([]);
      setAiSettings(null);
      setLoadingData(false);
    }
  }, [session]);

  const addTransaction = async (tx: Omit<Transaction, 'id'> & { id?: string }) => {
    const payload = {
      title: tx.title,
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
      category: tx.category || null,
      subcategory: tx.subcategory || null,
      method: tx.method || null,
      direction: tx.direction || null,
      accountId: tx.accountId || null,
      counterpartAccountId: tx.counterpartAccountId || null,
    };

    await apiFetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await refreshData();
  };

  const updateTransaction = async (tx: Transaction) => {
    const payload = {
      title: tx.title,
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
      category: tx.category || null,
      subcategory: tx.subcategory || null,
      method: tx.method || null,
      direction: tx.direction || null,
      accountId: tx.accountId || null,
      counterpartAccountId: tx.counterpartAccountId || null,
    };

    await apiFetch(`/api/transactions/${tx.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    await refreshData();
  };

  const deleteTransaction = async (id: string) => {
    await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
    await refreshData();
  };

  const deleteTransactionsBatch = async (ids: string[]) => {
    await apiFetch('/api/transactions/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
    await refreshData();
  };

  const saveTransactionsBatch = async (
    txs: Omit<Transaction, 'id'>[],
    batchMetadata: { name: string; type: string; raw_text: string }
  ) => {
    const payload = {
      metadata: {
        name: batchMetadata.name,
        type: batchMetadata.type,
        raw_text: batchMetadata.raw_text,
      },
      transactions: txs.map(tx => ({
        title: tx.title,
        amount: tx.amount,
        type: tx.type,
        date: tx.date,
        category: tx.category || null,
        subcategory: tx.subcategory || null,
        method: tx.method || null,
        direction: tx.direction || null,
        accountId: tx.accountId || null,
        counterpartAccountId: tx.counterpartAccountId || null,
      })),
    };

    await apiFetch('/api/transactions/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await refreshData();
  };

  const addAccount = async (acc: Omit<Account, 'id'>) => {
    const payload = {
      name: acc.name,
      emoji: acc.emoji || null,
      color: acc.color || null,
      anchorDate: acc.anchorDate || null,
      anchorBalance: acc.anchorBalance !== undefined ? acc.anchorBalance : null,
      parentAccountId: acc.parentAccountId || null,
    };

    await apiFetch('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await refreshData();
  };

  const updateAccount = async (acc: Account) => {
    const payload = {
      name: acc.name,
      emoji: acc.emoji || null,
      color: acc.color || null,
      anchorDate: acc.anchorDate || null,
      anchorBalance: acc.anchorBalance !== undefined ? acc.anchorBalance : null,
      parentAccountId: acc.parentAccountId || null,
    };

    await apiFetch(`/api/accounts/${acc.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    await refreshData();
  };

  const deleteAccount = async (id: string) => {
    await apiFetch(`/api/accounts/${id}`, { method: 'DELETE' });
    await refreshData();
  };

  const saveCustomCategories = async (categories: Record<string, string[]>) => {
    await apiFetch('/api/categories', {
      method: 'PUT',
      body: JSON.stringify(categories),
    });
    await refreshData();
  };

  const addPromptNote = async (note: Omit<PromptNote, 'id'>) => {
    await apiFetch('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ title: note.title, description: note.description }),
    });
    await refreshData();
  };

  const deletePromptNote = async (id: string) => {
    await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
    await refreshData();
  };

  return (
    <DataContext.Provider
      value={{
        transactions,
        accounts,
        customCategories,
        aiPromptNotes,
        aiSettings,
        loadingData,
        refreshData,
        refreshAISettings,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        deleteTransactionsBatch,
        saveTransactionsBatch,
        addAccount,
        updateAccount,
        deleteAccount,
        saveCustomCategories,
        addPromptNote,
        deletePromptNote,
        setTransactions,
        setAccounts,
        setCustomCategories,
        setAiPromptNotes,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData deve ser utilizado dentro de um DataProvider');
  }
  return context;
}
