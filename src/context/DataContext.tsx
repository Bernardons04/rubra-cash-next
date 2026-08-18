'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
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

  const refreshData = async () => {
    const uid = session?.user?.id;
    if (!uid) return;

    try {
      const [txRes, accRes, catRes, notesRes] = await Promise.all([
        supabaseBrowser.from('transactions').select('*').eq('user_id', uid).order('date', { ascending: false }),
        supabaseBrowser.from('accounts').select('*').eq('user_id', uid),
        supabaseBrowser.from('custom_categories').select('*').eq('user_id', uid),
        supabaseBrowser.from('notes').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
      ]);

      if (txRes.error) throw txRes.error;
      if (accRes.error) throw accRes.error;
      if (catRes.error) throw catRes.error;
      if (notesRes.error) throw notesRes.error;

      const mappedTxs: Transaction[] = (txRes.data || []).map(tx => ({
        id: tx.id,
        date: tx.date,
        title: tx.title,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        subcategory: tx.subcategory || '',
        method: tx.method,
        direction: tx.direction || null,
        accountId: tx.account_id || null,
        counterpartAccountId: tx.counterpart_account_id || null
      }));

      const mappedAccs: Account[] = (accRes.data || []).map(a => ({
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        color: a.color,
        anchorDate: a.anchor_date,
        anchorBalance: a.anchor_balance,
        parentAccountId: a.parent_account_id || null
      }));

      const mappedCats: Record<string, string[]> = {};
      (catRes.data || []).forEach(c => {
        mappedCats[c.category_name] = c.subcategories || [];
      });

      const mappedNotes: PromptNote[] = (notesRes.data || []).map(n => ({
        id: n.id,
        title: n.title,
        description: n.description
      }));

      setTransactions(mappedTxs);
      setAccounts(mappedAccs);
      setCustomCategories(mappedCats);
      setAiPromptNotes(mappedNotes);
    } catch (err: any) {
      console.error('Error refreshing data:', err);
      if (err?.code === 'PGRST303' || err?.message?.includes('JWT expired')) {
        setToast({ message: 'Sua sessão expirou. Por favor, faça login novamente.', type: 'warning' });
        logout();
      }
    } finally {
      setLoadingData(false);
    }
  };

  const refreshAISettings = async () => {
    if (!session) return;
    try {
      const token = session.access_token;
      const res = await fetch(`/api/user/ai-settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 404) {
        setAiSettings(null);
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
    const uid = session?.user?.id;
    if (!uid) return;

    const payload = {
      id: tx.id || crypto.randomUUID(),
      user_id: uid,
      date: tx.date,
      title: tx.title,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      subcategory: tx.subcategory || null,
      method: tx.method,
      direction: tx.direction,
      account_id: tx.accountId,
      counterpart_account_id: tx.counterpartAccountId || null,
    };

    const { error } = await supabaseBrowser.from('transactions').insert(payload);
    if (error) throw error;
    await refreshData();
  };

  const updateTransaction = async (tx: Transaction) => {
    const uid = session?.user?.id;
    if (!uid) return;

    const payload = {
      date: tx.date,
      title: tx.title,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      subcategory: tx.subcategory || null,
      method: tx.method,
      direction: tx.direction,
      account_id: tx.accountId,
      counterpart_account_id: tx.counterpartAccountId || null,
    };

    const { error } = await supabaseBrowser.from('transactions').update(payload).eq('id', tx.id);
    if (error) throw error;
    await refreshData();
  };

  const deleteTransaction = async (id: string) => {
    const { error } = await supabaseBrowser.from('transactions').delete().eq('id', id);
    if (error) throw error;
    await refreshData();
  };

  const deleteTransactionsBatch = async (ids: string[]) => {
    const { error } = await supabaseBrowser.from('transactions').delete().in('id', ids);
    if (error) throw error;
    await refreshData();
  };

  const saveTransactionsBatch = async (txs: Omit<Transaction, 'id'>[], batchMetadata: { name: string; type: string; raw_text: string }) => {
    const uid = session?.user?.id;
    if (!uid) return;

    // 1. Criar lote de importação
    const batchId = crypto.randomUUID();
    const { error: batchErr } = await supabaseBrowser.from('import_batches').insert({
      id: batchId,
      user_id: uid,
      file_name: batchMetadata.name,
      file_type: batchMetadata.type,
      raw_text: batchMetadata.raw_text,
    });
    if (batchErr) throw batchErr;

    // 2. Criar as transações vinculadas ao lote
    const toInsert = txs.map(tx => ({
      id: crypto.randomUUID(),
      user_id: uid,
      batch_id: batchId,
      date: tx.date,
      title: tx.title,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      subcategory: tx.subcategory || null,
      method: tx.method,
      direction: tx.direction,
      account_id: tx.accountId,
      counterpart_account_id: tx.counterpartAccountId || null,
    }));

    const { error: txErr } = await supabaseBrowser.from('transactions').insert(toInsert);
    if (txErr) throw txErr;

    await refreshData();
  };

  const addAccount = async (acc: Omit<Account, 'id'>) => {
    const uid = session?.user?.id;
    if (!uid) return;

    const { error } = await supabaseBrowser.from('accounts').insert({
      id: crypto.randomUUID(),
      user_id: uid,
      name: acc.name,
      emoji: acc.emoji,
      color: acc.color,
      anchor_date: acc.anchorDate,
      anchor_balance: acc.anchorBalance,
      parent_account_id: acc.parentAccountId || null,
    });
    if (error) throw error;
    await refreshData();
  };

  const updateAccount = async (acc: Account) => {
    const { error } = await supabaseBrowser.from('accounts').update({
      name: acc.name,
      emoji: acc.emoji,
      color: acc.color,
      anchor_date: acc.anchorDate,
      anchor_balance: acc.anchorBalance,
      parent_account_id: acc.parentAccountId || null,
    }).eq('id', acc.id);
    if (error) throw error;
    await refreshData();
  };

  const deleteAccount = async (id: string) => {
    const { error } = await supabaseBrowser.from('accounts').delete().eq('id', id);
    if (error) throw error;
    await refreshData();
  };

  const saveCustomCategories = async (categories: Record<string, string[]>) => {
    const uid = session?.user?.id;
    if (!uid) return;

    // Remove antigas do usuário e insere as novas
    const { error: deleteErr } = await supabaseBrowser.from('custom_categories').delete().eq('user_id', uid);
    if (deleteErr) throw deleteErr;

    const toInsert = Object.entries(categories).map(([category_name, subcategories]) => ({
      id: crypto.randomUUID(),
      user_id: uid,
      category_name,
      subcategories,
    }));

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabaseBrowser.from('custom_categories').insert(toInsert);
      if (insertErr) throw insertErr;
    }

    await refreshData();
  };

  const addPromptNote = async (note: Omit<PromptNote, 'id'>) => {
    const uid = session?.user?.id;
    if (!uid) return;

    const { error } = await supabaseBrowser.from('notes').insert({
      id: crypto.randomUUID(),
      user_id: uid,
      title: note.title,
      description: note.description,
    });
    if (error) throw error;
    await refreshData();
  };

  const deletePromptNote = async (id: string) => {
    const { error } = await supabaseBrowser.from('notes').delete().eq('id', id);
    if (error) throw error;
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
