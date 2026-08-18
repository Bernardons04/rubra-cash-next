'use client';

import { useState, useMemo, useRef } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useUI } from '@/context/UIContext';
import { useData, Transaction } from '@/context/DataContext';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import {
  formatBRL, formatDate, parseDate, getMonthKey, getMonthLabel,
  getDayGroupLabel, categoryEmoji, methodEmoji, methodLabel,
  PREDEFINED_CATEGORIES, uuid
} from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function TransactionsPage() {
  const router = useRouter();
  const { theme, setToast, session, showConfirm } = useUI();
  const { transactions, accounts, customCategories, aiPromptNotes, aiSettings, refreshData, setTransactions, loadingData } = useData();

  const currentUser = session?.user;

  const isDark = theme === 'dark';

  // Filters
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useLocalStorage('rubra-filter-month', '');
  const [filterAccount, setFilterAccount] = useLocalStorage('rubra-filter-account', '');
  const [filterCategory, setFilterCategory] = useLocalStorage('rubra-filter-category', '');
  const [filterType, setFilterType] = useLocalStorage('rubra-filter-type', '');

  // UI Selection State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [showTxModal, setShowTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAISetupModal, setShowAISetupModal] = useState(false);

  // Forms
  const today = new Date().toISOString().split('T')[0];
  const [txForm, setTxForm] = useState({
    type: 'expense', direction: 'out', title: '', amount: '',
    date: today, category: '', categoryNew: '', subcategory: '',
    subcategoryNew: '', method: 'pix', accountId: '', counterpartAccountId: ''
  });

  const [bulkForm, setBulkForm] = useState({
    type: '', direction: 'out', title: '', category: '', subcategory: '', accountId: ''
  });

  // AI Import State
  const [aiFileContent, setAiFileContent] = useState('');
  const [aiFileName, setAiFileName] = useState('');
  const [aiFileSize, setAiFileSize] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiLoadingMsg, setAiLoadingMsg] = useState('Identificando transações e categorias');
  const [importAccountId, setImportAccountId] = useState('');
  const [pendingTxs, setPendingTxs] = useState<any[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Memoized Data
  const availableMonths = useMemo(() => {
    const s = new Set<string>();
    transactions.forEach(tx => {
      const k = getMonthKey(tx.date);
      if (k) s.add(k);
    });
    return Array.from(s).sort().reverse();
  }, [transactions]);

  const allCategories = useMemo(() => {
    const pre = Object.keys(PREDEFINED_CATEGORIES);
    const cus = Object.keys(customCategories || {});
    return [...new Set([...pre, ...cus])].sort();
  }, [customCategories]);

  const getSubcategories = (cat: string) => {
    if (!cat || cat === '__new__') return [];
    const p = PREDEFINED_CATEGORIES[cat] || [];
    const c = customCategories[cat] || [];
    return [...new Set([...p, ...c])].sort();
  };

  const filteredTxs = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter(tx => {
      const mOk = !filterMonth || getMonthKey(tx.date) === filterMonth;
      const sOk = !q || (tx.title || '').toLowerCase().includes(q) || (tx.category || '').toLowerCase().includes(q);
      const cOk = !filterCategory || tx.category === filterCategory;
      const tOk = !filterType || tx.type === filterType;
      const aOk = !filterAccount || (filterAccount === '__none__' ? !tx.accountId : tx.accountId === filterAccount);
      return mOk && sOk && cOk && tOk && aOk;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, search, filterMonth, filterCategory, filterType, filterAccount]);

  const groupedTxs = useMemo(() => {
    const g: Record<string, Transaction[]> = {};
    filteredTxs.forEach(tx => {
      const k = tx.date || 'unknown';
      if (!g[k]) g[k] = [];
      g[k].push(tx);
    });
    return g;
  }, [filteredTxs]);

  const totalIncome = useMemo(() => filteredTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [filteredTxs]);
  const totalExpense = useMemo(() => filteredTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [filteredTxs]);
  const totalBalance = totalIncome - totalExpense;

  const getAccount = (id?: string | null) => id ? accounts.find(a => a.id === id) : null;

  // TX Modal Methods
  const openAddModal = () => {
    setEditingTx(null);
    setTxForm({ type: 'expense', direction: 'out', title: '', amount: '', date: new Date().toISOString().split('T')[0], category: '', categoryNew: '', subcategory: '', subcategoryNew: '', method: 'pix', accountId: '', counterpartAccountId: '' });
    setShowTxModal(true);
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setTxForm({
      type: tx.type, direction: tx.direction || 'out', title: tx.title, amount: String(tx.amount),
      date: tx.date, category: tx.category || '', categoryNew: '', subcategory: tx.subcategory || '',
      subcategoryNew: '', method: tx.method || 'other', accountId: tx.accountId || '', counterpartAccountId: tx.counterpartAccountId || ''
    });
    setShowTxModal(true);
  };

  const saveTx = async () => {
    const f = txForm;
    if (!f.title.trim()) { setToast({ message: 'Informe o título', type: 'error' }); return; }
    if (isNaN(Number(f.amount)) || parseFloat(f.amount) <= 0) { setToast({ message: 'Informe um valor válido', type: 'error' }); return; }
    if (!f.date || !parseDate(f.date)) { setToast({ message: 'Informe uma data válida', type: 'error' }); return; }

    let category = f.category === '__new__' ? f.categoryNew.trim() : f.category;
    let subcategory = f.subcategory === '__new__' ? f.subcategoryNew.trim() : f.subcategory;

    const txId = editingTx?.id || uuid();
    const newTx: Transaction = {
      id: txId,
      type: f.type as 'income' | 'expense' | 'transfer',
      direction: f.type === 'transfer' ? 'out' : null,
      title: f.title.trim(),
      amount: Math.abs(parseFloat(f.amount)),
      date: f.date,
      category: category || '',
      subcategory: subcategory || '',
      method: f.method,
      accountId: f.accountId || '',
      counterpartAccountId: f.type === 'transfer' ? (f.counterpartAccountId || '') : '',
    };

    let newTxs = [...transactions];
    if (editingTx) {
      newTxs = newTxs.map(t => t.id === txId ? newTx : t);
    } else {
      newTxs.push(newTx);
    }
    setTransactions(newTxs);

    if (currentUser) {
      const payload = {
        title: newTx.title, amount: newTx.amount, type: newTx.type, date: newTx.date,
        category: newTx.category, subcategory: newTx.subcategory || null, method: newTx.method,
        account_id: newTx.accountId || null, 
        direction: newTx.direction || null, 
        counterpart_account_id: newTx.counterpartAccountId || null,
        user_id: currentUser.id
      };
      try {
        if (editingTx) {
          const { error } = await supabaseBrowser.from('transactions').update(payload).eq('id', newTx.id);
          if (error) throw error;
        } else {
          const { error } = await supabaseBrowser.from('transactions').insert({ ...payload, id: newTx.id });
          if (error) throw error;
        }
        setToast({ message: editingTx ? 'Transação atualizada!' : 'Transação adicionada!', type: 'success' });
      } catch (err: any) {
        setToast({ message: 'Erro ao salvar: ' + err.message, type: 'error' });
        if (!editingTx) setTransactions(transactions.filter(t => t.id !== newTx.id));
        return;
      }
    } else {
      setToast({ message: editingTx ? 'Transação atualizada!' : 'Transação adicionada!', type: 'success' });
    }
    setShowTxModal(false);
    refreshData();
  };

  const deleteTx = async (tx: Transaction) => {
    const confirmed = await showConfirm('Deletar transação', `Excluir "${tx.title}"?`);
    if (!confirmed) return;
    try {
      setTransactions(transactions.filter(t => t.id !== tx.id));
      if (currentUser) {
        const { error } = await supabaseBrowser.from('transactions').delete().eq('id', tx.id);
        if (error) { setToast({ message: 'Erro ao excluir: ' + error.message, type: 'error' }); return; }
      }
      setToast({ message: 'Transação removida', type: 'info' });
    } catch (err: any) {
      setToast({ message: 'Erro ao excluir: ' + err.message, type: 'error' });
    }
  };

  // Selection Methods
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedIds([]);
  };

  const selectAllVisible = () => {
    const ids = filteredTxs.map(t => t.id);
    setSelectedIds([...new Set([...selectedIds, ...ids])]);
  };

  const selectSameTitle = () => {
    if (!selectedIds.length) { setToast({ message: 'Selecione ao menos uma transação', type: 'warning' }); return; }
    const titles = new Set(selectedIds.map(id => transactions.find(x => x.id === id)?.title).filter(Boolean));
    const ids = filteredTxs.filter(t => titles.has(t.title)).map(t => t.id);
    setSelectedIds([...new Set([...selectedIds, ...ids])]);
    setToast({ message: `${selectedIds.length + ids.length} transações selecionadas`, type: 'info' });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const bulkDelete = async () => {
    const n = selectedIds.length;
    if (!n) return;
    const confirmed = await showConfirm('Excluir em lote', `Excluir ${n} transação${n !== 1 ? 's' : ''}?`);
    if (!confirmed) return;
    setTransactions(transactions.filter(t => !selectedIds.includes(t.id)));
    if (currentUser) {
      const { error } = await supabaseBrowser.from('transactions').delete().in('id', selectedIds);
      if (error) { setToast({ message: 'Erro ao excluir: ' + error.message, type: 'error' }); return; }
    }
    exitSelectionMode();
    setToast({ message: `${n} transações excluídas`, type: 'info' });
  };

  const openBulkEdit = () => {
    if (!selectedIds.length) return;
    setBulkForm({ type: '', direction: 'out', title: '', category: '', subcategory: '', accountId: '' });
    setShowBulkModal(true);
  };

  const saveBulkEdit = async () => {
    const ids = [...selectedIds];
    const f = bulkForm;
    const newTxs = transactions.map(tx => {
      if (!ids.includes(tx.id)) return tx;
      const u = { ...tx };
      if (f.title) u.title = f.title;
      if (f.type) { u.type = f.type as any; if (f.type === 'transfer') u.direction = f.direction as any; else u.direction = null as any; }
      if (f.category) u.category = f.category;
      if (f.subcategory) u.subcategory = f.subcategory;
      if (f.accountId === '__none__') u.accountId = '';
      else if (f.accountId) u.accountId = f.accountId;
      return u;
    });
    setTransactions(newTxs);

    if (currentUser && ids.length) {
      try {
        const updated = newTxs.filter(tx => ids.includes(tx.id));
        const results = await Promise.all(updated.map(tx =>
          supabaseBrowser.from('transactions').update({
            title: tx.title, type: tx.type, direction: tx.direction ?? null,
            category: tx.category, subcategory: tx.subcategory || null, account_id: tx.accountId || null
          }).eq('id', tx.id)
        ));
        const errs = results.filter(r => r.error);
        if (errs.length) throw new Error(errs[0].error?.message);
      } catch (err: any) { setToast({ message: 'Erro ao atualizar: ' + err.message, type: 'error' }); return; }
    }
    setShowBulkModal(false);
    exitSelectionMode();
    setToast({ message: `${ids.length} transações atualizadas!`, type: 'success' });
  };

  // AI Methods
  const openImportModal = () => {
    if (!aiSettings) {
      setShowAISetupModal(true);
      return;
    }
    setPendingTxs([]); setAiFileContent(''); setAiFileName(''); setAiFileSize('');
    setAiProcessing(false); setAiProgress(0);
    setShowImportModal(true);
  };

  const cancelImport = () => {
    setAiProcessing(false); setShowImportModal(false);
    setPendingTxs([]); setAiFileContent(''); setAiFileName('');
  };

  const handleFile = (file: File) => {
    setAiFileName(file.name);
    setAiFileSize(`(${(file.size / 1024).toFixed(1)} KB)`);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'pdf') {
      setToast({ message: `Lendo "${file.name}"...`, type: 'info' });
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target!.result as ArrayBuffer);

          if (!(window as any).pdfjsLib) {
            await new Promise<void>((resolve) => {
              const script = document.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
              script.onload = () => resolve();
              document.head.appendChild(script);
            });
            if ((window as any).pdfjsLib) {
              (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
          }

          const pdfjsLib = (window as any).pdfjsLib;
          if (!pdfjsLib) {
            const base64 = btoa(String.fromCharCode(...typedArray));
            setAiFileContent(`[PDF:base64] ${base64}`);
            setToast({ message: `"${file.name}" lido como base64`, type: 'info' });
            return;
          }

          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((item: any) => item.str).join(' ');
            fullText += `\n--- Página ${i} ---\n${pageText}`;
          }

          if (!fullText.trim()) {
            setToast({ message: 'PDF vazio ou imagem. Tente TXT ou CSV.', type: 'error' });
            return;
          }

          setAiFileContent(fullText);
          setToast({ message: `"${file.name}" carregado!`, type: 'info' });
        } catch (err) {
          setToast({ message: 'Erro ao extrair PDF', type: 'error' });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const r = new FileReader();
      r.onload = e => { setAiFileContent(e.target?.result as string); setToast({ message: `"${file.name}" carregado!`, type: 'info' }); };
      r.onerror = () => setToast({ message: 'Erro ao ler arquivo', type: 'error' });
      r.readAsText(file, 'UTF-8');
    }
  };

  const handleAIImport = async () => {
    if (!aiFileContent) { setToast({ message: 'Selecione um arquivo primeiro', type: 'warning' }); return; }
    setAiProcessing(true); setAiProgress(1);
    const msgs = ['Lendo o extrato...', 'Identificando transações...', 'Classificando categorias...', 'Detectando métodos...', 'Finalizando...'];
    let mi = 0;
    const iv = setInterval(() => {
      setAiProgress(p => {
        const next = Math.min(p + Math.random() * 12, 90);
        if (mi < msgs.length - 1 && next > (mi + 1) * 18) { mi++; setAiLoadingMsg(msgs[mi]); }
        return next;
      });
    }, 600);

    try {
      const cats: Record<string, string[]> = {};
      allCategories.forEach(c => { cats[c] = getSubcategories(c); });

      const payloadAccounts = accounts
        .filter(a => !a.parentAccountId)
        .map(a => ({
          id: a.id,
          name: a.name,
          vaults: accounts.filter(v => v.parentAccountId === a.id).map(v => ({ id: v.id, name: v.name }))
        }));

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          content: aiFileContent, 
          fileName: aiFileName, 
          categories: cats, 
          notes: aiPromptNotes,
          userName: currentUser?.user_metadata?.name || currentUser?.email || 'Usuário',
          accounts: payloadAccounts
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro desconhecido');

      clearInterval(iv); setAiProgress(100);
      const valid = (data.transactions || []).filter((tx: any) => tx.title && tx.amount && tx.date).map((tx: any) => ({
        id: uuid(),
        type: ['income', 'expense', 'transfer'].includes(tx.type) ? tx.type : 'expense',
        direction: tx.type === 'transfer' ? (['in', 'out'].includes(tx.direction) ? tx.direction : 'out') : null,
        title: String(tx.title).trim(), amount: Math.abs(parseFloat(tx.amount) || 0),
        date: tx.date.includes('T') ? tx.date.split('T')[0] : tx.date,
        category: tx.type === 'transfer' ? '' : (tx.category || 'Outros'), 
        subcategory: tx.type === 'transfer' ? '' : (tx.subcategory || ''),
        method: ['pix', 'credit_card', 'debit_card', 'boleto', 'transfer', 'other'].includes(tx.method) ? tx.method : 'other',
        accountId: importAccountId || '',
        counterpartAccountId: tx.counterpart_account_id || null,
        counterpartNameHint: tx.counterpart_name_hint || null,
      })).filter((tx: any) => tx.amount > 0 && parseDate(tx.date));

      if (!valid.length) throw new Error('Nenhuma transação válida encontrada');
      setPendingTxs(valid);
      setToast({ message: `✨ ${valid.length} transações identificadas!`, type: 'success' });
    } catch (err: any) {
      clearInterval(iv);
      if (err.message && (err.message.includes('404') || err.message.toLowerCase().includes('configura'))) {
        setShowImportModal(false); setShowAISetupModal(true);
      } else {
        setToast({ message: 'Erro: ' + err.message, type: 'error' });
      }
    } finally {
      setAiProcessing(false);
    }
  };

  const confirmImport = async () => {
    if (!currentUser) { setToast({ message: 'Você não está logado!', type: 'error' }); return; }
    if (!pendingTxs.length) return;
    try {
      const batchId = uuid();
      const { error: batchErr } = await supabaseBrowser.from('import_batches').insert({
        id: batchId, user_id: currentUser.id, file_name: aiFileName,
        file_size: aiFileContent.length, transaction_count: pendingTxs.length,
        imported_at: new Date().toISOString()
      });
      if (batchErr) throw batchErr;

      const toInsert = pendingTxs.map(tx => ({
        id: uuid(), user_id: currentUser.id, title: tx.title, amount: tx.amount, type: tx.type,
        direction: tx.direction || null, date: tx.date, category: tx.category || 'Outros',
        subcategory: tx.subcategory || null, method: tx.method || 'other', account_id: tx.accountId || null,
        counterpart_account_id: tx.counterpartAccountId || null,
        import_batch_id: batchId, created_at: new Date().toISOString()
      }));

      const { error: txErr } = await supabaseBrowser.from('transactions').insert(toInsert);
      if (txErr) throw txErr;

      setToast({ message: `✅ ${pendingTxs.length} transações salvas!`, type: 'success' });
      cancelImport();
      refreshData();
    } catch (err: any) { setToast({ message: `Erro ao salvar: ${err.message}`, type: 'error' }); }
  };

  const flattenedList = useMemo(() => {
    const list: Array<{ type: 'header', date: string } | { type: 'transaction', tx: Transaction }> = [];
    Object.entries(groupedTxs).forEach(([date, group]) => {
      list.push({ type: 'header', date });
      group.forEach(tx => {
        list.push({ type: 'transaction', tx });
      });
    });
    return list;
  }, [groupedTxs]);

  const virtualizer = useWindowVirtualizer({
    count: flattenedList.length,
    estimateSize: (index) => flattenedList[index].type === 'header' ? 44 : 76,
    overscan: 10,
  });

  return (
    <div className="flex flex-col gap-5">
      {/* STAT PILLS */}
      <div className="flex flex-wrap gap-2">
        <div className={`flex items-center gap-2 rounded-md border px-3 py-1.5 whitespace-nowrap ${isDark ? 'bg-[#141414] border-[#262626]' : 'bg-white border-zinc-200'}`}>
          <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">Receitas</span>
          <span className="font-mono text-sm font-semibold text-[#75d934]">{formatBRL(totalIncome)}</span>
        </div>
        <div className={`flex items-center gap-2 rounded-md border px-3 py-1.5 whitespace-nowrap ${isDark ? 'bg-[#141414] border-[#262626]' : 'bg-white border-zinc-200'}`}>
          <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">Despesas</span>
          <span className="font-mono text-sm font-semibold text-[#ff4d6d]">{formatBRL(totalExpense)}</span>
        </div>
        <div className={`flex items-center gap-2 rounded-md border px-3 py-1.5 whitespace-nowrap ${isDark ? 'bg-[#141414] border-[#262626]' : 'bg-white border-zinc-200'}`}>
          <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">Saldo período</span>
          <span className="font-mono text-sm font-semibold" style={{ color: totalBalance >= 0 ? '#75d934' : '#ff4d6d' }}>{formatBRL(totalBalance)}</span>
        </div>
      </div>

      {/* FILTERS & CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <i className="bi bi-search absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar transações..."
              className={`w-full rounded-sm border py-2 pr-8 pl-9 text-sm outline-none
                ${isDark ? 'bg-[#1C1C1C] border-[#262626] text-[#F0F0F0] focus:border-zinc-500' : 'bg-white border-zinc-200 text-zinc-800 focus:border-zinc-400'}`}
            />
            {search && (
              <button onClick={() => setSearch('')} className="cursor-pointer absolute top-1/2 right-2.5 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                <i className="bi bi-x text-lg" />
              </button>
            )}
          </div>

          <select className={`rounded-sm border px-3 py-2 text-sm outline-none cursor-pointer ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
            <option value="">Todas as contas</option>
            <option value="__none__">Sem conta</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.emoji || '🏦'} {a.name}</option>)}
          </select>

          <select className={`rounded-sm border px-3 py-2 text-sm outline-none cursor-pointer ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
            <option value="">Todos os meses</option>
            {availableMonths.map(m => <option key={m} value={m}>{getMonthLabel(m)}</option>)}
          </select>

          <select className={`rounded-sm border px-3 py-2 text-sm outline-none cursor-pointer ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">Todas as categorias</option>
            {allCategories.map(cat => <option key={cat} value={cat}>{categoryEmoji(cat)} {cat}</option>)}
          </select>

          <select className={`rounded-sm border px-3 py-2 text-sm outline-none cursor-pointer ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
            <option value="transfer">Transferências</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button onClick={openImportModal} className="flex items-center gap-2 rounded-sm bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 cursor-pointer">
            <i className="bi bi-robot" /> Importar (IA)
          </button>
          <button onClick={openAddModal} className={`flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-medium cursor-pointer ${isDark ? 'border-[#262626] bg-[#141414] hover:bg-[#1C1C1C]' : 'border-zinc-200 bg-white hover:bg-zinc-50'}`}>
            <i className="bi bi-plus-lg" /> Nova
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <span className="font-mono text-xs text-zinc-500">{filteredTxs.length} registro{filteredTxs.length !== 1 ? 's' : ''}</span>
        <button onClick={toggleSelectionMode} className={`cursor-pointer flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${selectionMode ? 'btn-ghost btn-active' : 'btn-ghost'}`}>
          <i className="bi bi-check2-square" /> {selectionMode ? 'Cancelar' : 'Selecionar'}
        </button>
      </div>

      {/* TRANSACTION LIST */}
      {filteredTxs.length > 0 ? (
        <div className="pb-24">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = flattenedList[virtualItem.index];
              
              if (item.type === 'header') {
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <div className={`mt-2 mb-1 w-fit rounded-sm border px-2.5 py-1 text-xs font-bold ${isDark ? 'bg-[#1C1C1C] border-[#262626] text-zinc-200' : 'bg-zinc-50 border-zinc-200 text-zinc-800'}`}>
                      {getDayGroupLabel(item.date)}
                    </div>
                  </div>
                );
              }

              const tx = item.tx;
              const acc = getAccount(tx.accountId);
              const isSelected = selectedIds.includes(tx.id);

              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className="py-0.5"
                >
                  <div
                    onClick={() => selectionMode && toggleSelect(tx.id)}
                    className={`relative flex items-center justify-between gap-2.5 rounded-[12px] border px-4 py-[11px] transition-colors
                      ${isDark ? 'bg-[#141414] border-[#262626] hover:bg-[#1C1C1C]' : 'bg-white border-zinc-200 hover:bg-zinc-50'}
                      ${selectionMode ? 'cursor-pointer' : ''}
                      ${isSelected ? '!bg-[var(--accent-dim)] !border-[#a84551]' : ''}
                    `}
                    style={{ borderLeftWidth: 3, borderLeftColor: isSelected ? '#a84551' : (tx.type === 'income' ? '#75d934' : tx.type === 'expense' ? '#ff4d6d' : '#4d9fff') }}
                  >
                    {selectionMode && (
                      <div className="mr-1 flex items-center">
                        <input type="checkbox" checked={isSelected} readOnly className="h-4 w-4 accent-[#a84551] cursor-pointer" />
                      </div>
                    )}

                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-lg" style={{ background: tx.type === 'income' ? '#75d9341f' : tx.type === 'expense' ? '#ff4d6d1f' : '#4d9fff1f' }}>
                        {categoryEmoji(tx.category)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{tx.title}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {tx.type !== 'transfer' && tx.category && <span className="rounded-sm border border-[#a84551]/40 bg-[#a84551]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#a84551]">{tx.category}</span>}
                          {tx.type !== 'transfer' && tx.subcategory && <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-500'}`}>{tx.subcategory}</span>}
                          <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-500'}`}>{methodEmoji(tx.method)} {methodLabel(tx.method)}</span>
                          {tx.type !== 'transfer' && acc && (
                            <span className="rounded-sm border px-1.5 py-0.5 text-[10px] font-medium" style={{ borderColor: acc.color, color: acc.color, background: `${acc.color}18` }}>
                              {acc.emoji || '🏦'} {acc.name}
                            </span>
                          )}
                          {tx.type === 'transfer' && (
                            <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${isDark ? 'border-[#333] text-zinc-300 bg-[#262626]' : 'border-zinc-300 text-zinc-700 bg-zinc-100'}`}>
                              {(() => {
                                const accStr = acc ? `${acc.emoji || '🏦'} ${acc.name}` : '[Desconhecido]';
                                let cpStr = '[Destino Desconhecido]';
                                if (tx.counterpartAccountId) {
                                  const cp = getAccount(tx.counterpartAccountId);
                                  cpStr = cp ? `${cp.emoji || '🏦'} ${cp.name}` : '[Conta Excluída]';
                                } else if ((tx as any).counterpartNameHint) {
                                  cpStr = `[${(tx as any).counterpartNameHint}]`;
                                }
                                return tx.direction === 'in' ? `${cpStr} → ${accStr}` : `${accStr} → ${cpStr}`;
                              })()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <div className="font-mono text-[15px] font-semibold" style={{ color: tx.type === 'income' ? '#75d934' : tx.type === 'expense' ? '#ff4d6d' : '#4d9fff' }}>
                        {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '↔' : '-'} {formatBRL(tx.amount)}
                      </div>
                      {!selectionMode && (
                        <div className="flex gap-1">
                          <button onClick={(e) => { e.stopPropagation(); openEditModal(tx); }} className={`cursor-pointer flex h-7 w-7 items-center justify-center rounded-md ${isDark ? 'bg-[#262626] text-zinc-300 hover:bg-[#333]' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteTx(tx); }} className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-md bg-[#ff4d6d1f] text-[#ff4d6d] hover:bg-[#ff4d6d33]">
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : loadingData ? (
        <div className="flex justify-center items-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-[#a84551]" />
        </div>
      ) : (
        <div className="py-20 text-center text-zinc-400">
          <i className="bi bi-cash-stack mb-4 block text-5xl" />
          <h3 className="font-display mb-2 text-xl text-zinc-600 dark:text-zinc-300">Nenhuma transação ainda</h3>
          <p className="text-sm">Importe um extrato com IA ou adicione manualmente.</p>
          <button onClick={openAddModal} className="mt-4 cursor-pointer rounded-sm bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            <i className="bi bi-plus-lg" /> Adicionar transação
          </button>
        </div>
      )}

      {/* BULK ACTION BAR */}
      <div className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-3 rounded-[18px] border p-4 shadow-2xl duration-300 w-[90vw] max-w-[440px] ${isDark ? 'bg-[#141414] border-[#333333]' : 'bg-[#f4f4f4] border-[#e8e8f8]'} ${selectionMode && selectedIds.length > 0 ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full border border-[#a84551] bg-[#a845511f] px-2.5 py-0.5 font-mono text-[13px] font-semibold text-[#a84551]">
            {selectedIds.length} selecionada{selectedIds.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button onClick={selectAllVisible} className={`cursor-pointer flex items-center justify-center rounded-[8px] border px-[10px] py-[6px] text-[13px] font-medium transition-colors ${isDark ? 'bg-[#141414] border-[#262626] text-[#A3A3A3] hover:bg-[#000000] hover:text-[#F0F0F0] hover:border-[#333333]' : 'bg-[#f4f4f4] border-[#E5E5E5] text-[#525252] hover:bg-[#ffffff] hover:text-[#0A0A0A] hover:border-[#e8e8f8]'}`}>Todas visíveis</button>
            <button onClick={selectSameTitle} className={`cursor-pointer flex items-center justify-center rounded-[8px] border px-[10px] py-[6px] text-[13px] font-medium transition-colors ${isDark ? 'bg-[#141414] border-[#262626] text-[#A3A3A3] hover:bg-[#000000] hover:text-[#F0F0F0] hover:border-[#333333]' : 'bg-[#f4f4f4] border-[#E5E5E5] text-[#525252] hover:bg-[#ffffff] hover:text-[#0A0A0A] hover:border-[#e8e8f8]'}`}>Mesmo título</button>
          </div>
        </div>
        
        <div className={`h-px w-full ${isDark ? 'bg-[#333333]' : 'bg-[#E5E5E5]'}`} />
        
        <div className="flex items-center justify-between gap-2">
          <button onClick={openBulkEdit} className={`cursor-pointer flex items-center justify-center gap-[6px] rounded-[8px] border px-[10px] py-[6px] text-[13px] font-medium transition-colors ${isDark ? 'bg-[#141414] border-[#262626] text-[#A3A3A3] hover:bg-[#000000] hover:text-[#F0F0F0] hover:border-[#333333]' : 'bg-[#f4f4f4] border-[#E5E5E5] text-[#525252] hover:bg-[#ffffff] hover:text-[#0A0A0A] hover:border-[#e8e8f8]'}`}>
            <i className="bi bi-pencil-square" /> Editar em lote
          </button>
          <button onClick={bulkDelete} className="cursor-pointer flex items-center justify-center gap-[6px] rounded-[8px] border border-transparent bg-[#ff4d6d18] px-[10px] py-[6px] text-[13px] font-medium text-[#ff4d6d] transition-colors hover:bg-[#ff4d6d] hover:text-white">
            <i className="bi bi-trash" /> Excluir
          </button>
          <button onClick={exitSelectionMode} className={`cursor-pointer flex items-center justify-center gap-[6px] rounded-[8px] border px-[10px] py-[6px] text-[13px] font-medium transition-colors ${isDark ? 'bg-[#141414] border-[#262626] text-[#A3A3A3] hover:bg-[#000000] hover:text-[#F0F0F0] hover:border-[#333333]' : 'bg-[#f4f4f4] border-[#E5E5E5] text-[#525252] hover:bg-[#ffffff] hover:text-[#0A0A0A] hover:border-[#e8e8f8]'}`}>
            <i className="bi bi-x-lg" /> Cancelar
          </button>
        </div>
      </div>

      {/* TX MODAL */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowTxModal(false); }}>
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl ${isDark ? 'bg-[#141414] border-[#262626]' : 'bg-white border-zinc-200'}`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingTx ? 'Editar Transação' : 'Nova Transação'}</h2>
              <button onClick={() => setShowTxModal(false)} className="cursor-pointer text-zinc-400 hover:text-zinc-600"><i className="bi bi-x-lg" /></button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Tipo</label>
                <div className={`grid grid-cols-3 gap-1 rounded-sm p-1`}>
                  {['income', 'expense', 'transfer'].map(t => (
                    <label key={t} className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium border ${txForm.type === t
                      ? (t === 'income' ? 'bg-[var(--green-dim)] text-[var(--green)] border-[var(--green)]' : t === 'expense' ? 'bg-[var(--red-dim)] text-[var(--red)] border-[var(--red)]' : 'bg-[var(--blue-dim)] text-[var(--blue)] border-[var(--blue)]')
                      : `text-[var(--text-2)] hover:bg-[var(--card-hover)] hover:text-[var(--text)] ${isDark ? 'border-[#262626]' : 'border-zinc-200'}`
                      }`}>
                      <input type="radio" name="tx-type" value={t} checked={txForm.type === t} onChange={e => setTxForm({ ...txForm, type: e.target.value })} className="hidden" />
                      {t === 'income' ? <><i className="bi bi-graph-up-arrow" /> Receita</> : t === 'expense' ? <><i className="bi bi-graph-down-arrow" /> Despesa</> : <><i className="bi bi-arrow-left-right" /> Transf.</>}
                    </label>
                  ))}
                </div>
              </div>



              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Título / Descrição</label>
                <input type="text" className={`rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} placeholder="Ex: Salário, iFood, Aluguel..." value={txForm.title} onChange={e => setTxForm({ ...txForm, title: e.target.value })} />
              </div>

              <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Valor (R$)</label>
                  <input type="number" step="0.01" className={`rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} placeholder="0,00" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Data</label>
                  <input type="date" className={`rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={txForm.date} onChange={e => setTxForm({ ...txForm, date: e.target.value })} />
                </div>
              </div>

              {txForm.type !== 'transfer' && (
                <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">Categoria</label>
                    <select className={`rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={txForm.category} onChange={e => setTxForm({ ...txForm, category: e.target.value, subcategory: '' })}>
                      <option value="">Selecionar categoria</option>
                      {allCategories.map(c => <option key={c} value={c}>{categoryEmoji(c)} {c}</option>)}
                      <option value="__new__">➕ Criar nova categoria</option>
                    </select>
                    {txForm.category === '__new__' && (
                      <input type="text" className={`mt-1 rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} placeholder="Nova categoria" value={txForm.categoryNew} onChange={e => setTxForm({ ...txForm, categoryNew: e.target.value })} />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">Subcategoria</label>
                    <select className={`rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={txForm.subcategory} onChange={e => setTxForm({ ...txForm, subcategory: e.target.value })}>
                      <option value="">{txForm.category ? 'Sem subcategoria' : 'Selecione uma categoria'}</option>
                      {getSubcategories(txForm.category).map(s => <option key={s} value={s}>{s}</option>)}
                      {txForm.category && txForm.category !== '__new__' && <option value="__new__">➕ Criar nova</option>}
                    </select>
                    {txForm.subcategory === '__new__' && (
                      <input type="text" className={`mt-1 rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} placeholder="Nova subcategoria" value={txForm.subcategoryNew} onChange={e => setTxForm({ ...txForm, subcategoryNew: e.target.value })} />
                    )}
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Método de Pagamento</label>
                  <select className={`rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={txForm.method} onChange={e => setTxForm({ ...txForm, method: e.target.value })}>
                    <option value="pix">💬 PIX</option>
                    <option value="credit_card">💳 Crédito</option>
                    <option value="debit_card">🏧 Débito</option>
                    <option value="boleto">📜 Boleto</option>
                    <option value="transfer">🔄 Transferência</option>
                    <option value="other">📦 Outro</option>
                  </select>
                </div>
                {txForm.type !== 'transfer' ? (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">
                      {txForm.type === 'income' ? 'Conta onde entrou (opcional)' : 'Conta de onde saiu (opcional)'}
                    </label>
                    <select className={`rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={txForm.accountId} onChange={e => setTxForm({ ...txForm, accountId: e.target.value })}>
                      <option value="">Sem conta</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.parentAccountId ? '\u00A0\u00A0└\u00A0' : ''}{a.emoji || '🏦'} {a.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">De (origem)</label>
                    <select className={`rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={txForm.accountId} onChange={e => setTxForm({ ...txForm, accountId: e.target.value })}>
                      <option value="">Selecione a origem</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.parentAccountId ? '\u00A0\u00A0└\u00A0' : ''}{a.emoji || '🏦'} {a.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {txForm.type === 'transfer' && (
                <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">Para (destino)</label>
                    <select className={`rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={txForm.counterpartAccountId} onChange={e => setTxForm({ ...txForm, counterpartAccountId: e.target.value })}>
                      <option value="">Selecione o destino</option>
                      {accounts.map(a => <option key={a.id} value={a.id} disabled={a.id === txForm.accountId}>{a.parentAccountId ? '\u00A0\u00A0└\u00A0' : ''}{a.emoji || '🏦'} {a.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {txForm.type === 'transfer' && (
                <div className={`rounded-sm border p-3 text-sm ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-zinc-50 border-zinc-200'}`}>
                  <p className="text-xs text-zinc-500">
                    ℹ️ Somente o saldo da conta de origem será atualizado. Para refletir o saldo no destino, lance também a entrada na conta de destino.
                  </p>
                </div>
              )}

              <div className="mt-2 flex gap-2">
                <button onClick={saveTx} className="flex-1 rounded-sm bg-[var(--accent)] px-4 py-2 font-medium text-white hover:brightness-110 cursor-pointer">Salvar Transação</button>
                <button onClick={() => setShowTxModal(false)} className={`rounded-sm border px-4 py-2 font-medium cursor-pointer ${isDark ? 'border-[#262626] bg-[#141414] hover:bg-[#1C1C1C]' : 'border-zinc-200 bg-white hover:bg-zinc-50'}`}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT (IA) MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) cancelImport(); }}>
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl ${isDark ? 'bg-[#141414] border-[#262626]' : 'bg-white border-zinc-200'}`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold"><i className="bi bi-robot" /> Importar Extrato com IA</h2>
              <button onClick={cancelImport} className="text-zinc-400 hover:text-zinc-600"><i className="bi bi-x-lg" /></button>
            </div>
            <div className="flex flex-col gap-4">
              {!aiProcessing && !pendingTxs.length && (
                <>
                  <div
                    className={`relative cursor-pointer rounded-sm border-2 border-dashed p-8 text-center ${dragOver ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : isDark ? 'border-[#333] bg-[#1C1C1C] hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]' : 'border-zinc-200 bg-zinc-50 hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]'}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                  >
                    <input type="file" className="absolute inset-0 cursor-pointer opacity-0" accept=".pdf,.txt,.csv,.ofx,.xls,.xlsx" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                    <i className="bi bi-file-earmark-text mb-2 block text-4xl text-zinc-400" />
                    <h4 className="font-display font-medium">Solte seu extrato aqui</h4>
                    <p className="text-xs text-zinc-500">PDF, TXT, CSV, OFX • Clique ou arraste</p>
                  </div>

                  {aiFileName && (
                    <div className={`rounded-sm border px-3 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-300 ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-zinc-50 border-zinc-200'}`}>
                      <i className="bi bi-file-earmark-check" /> {aiFileName} {aiFileSize}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">Conta do extrato (opcional)</label>
                    <select className={`rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={importAccountId} onChange={e => setImportAccountId(e.target.value)}>
                      <option value="">Sem conta / Geral</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.emoji || '🏦'} {a.name}</option>)}
                    </select>
                  </div>

                  <div className={`rounded-sm border p-3 text-sm ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-zinc-50 border-zinc-200'}`}>
                    <p className="mb-1 font-semibold">⚠️ Importante:</p>
                    <ul className="list-disc pl-5 text-xs text-zinc-500 dark:text-zinc-400">
                      <li>A IA <strong>pode cometer erros</strong> na classificação. <strong>Sempre revise</strong> os valores e categorias.</li>
                      <li>Para análises mais precisas, importe extratos <strong>mensais</strong> em vez de períodos muito longos.</li>
                    </ul>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button onClick={handleAIImport} disabled={!aiFileContent} className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-[var(--accent)] px-4 py-2 font-medium text-white hover:brightness-110 disabled:opacity-50">
                      <i className="bi bi-robot" /> Processar com IA
                    </button>
                    <button onClick={cancelImport} className={`rounded-sm border px-4 py-2 font-medium ${isDark ? 'border-[#262626] bg-[#141414] hover:bg-[#1C1C1C]' : 'border-zinc-200 bg-white hover:bg-zinc-50'}`}>Cancelar</button>
                  </div>
                </>
              )}

              {aiProcessing && (
                <div className="py-8 text-center">
                  <div className="font-mono text-sm font-medium"><i className="bi bi-cpu" /> Analisando extrato com IA...</div>
                  <div className="mt-1 text-xs text-zinc-500">{aiLoadingMsg}</div>
                  <div className={`mt-4 h-1 w-full overflow-hidden rounded-full ${isDark ? 'bg-[#333]' : 'bg-zinc-200'}`}>
                    <div className="h-full bg-zinc-800 dark:bg-zinc-200" style={{ width: `${aiProgress}%` }} />
                  </div>
                </div>
              )}

              {pendingTxs.length > 0 && !aiProcessing && (
                <>
                  <div className={`rounded-sm border p-3 flex flex-col gap-1 max-h-64 overflow-y-auto ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-zinc-50 border-zinc-200'}`}>
                    {pendingTxs.map((tx, i) => (
                      <div key={i} className={`flex items-start gap-2 py-2 ${i < pendingTxs.length - 1 ? (isDark ? 'border-b border-[#333]' : 'border-b border-zinc-200') : ''}`}>
                        <div className="h-full min-h-[30px] w-1 shrink-0 rounded-full" style={{ background: tx.type === 'income' ? '#75d934' : tx.type === 'transfer' ? '#4d9fff' : '#ff4d6d' }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-xs font-semibold">{tx.title}</span>
                            <span className="whitespace-nowrap text-xs font-bold" style={{ color: tx.type === 'income' ? '#75d934' : tx.type === 'transfer' ? '#4d9fff' : '#ff4d6d' }}>
                              {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '↔' : '-'}{formatBRL(tx.amount)}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-1 flex flex-col gap-1.5">
                            <span>{formatDate(tx.date)} {tx.type !== 'transfer' ? `· ${tx.category || 'Outros'}` : ''}</span>
                            {tx.type === 'transfer' && !tx.counterpartAccountId && (tx as any).counterpartNameHint && (
                              <div className="flex flex-col gap-1.5 mt-1 rounded-sm border p-2" style={{ borderColor: '#ff4d6d40', backgroundColor: '#ff4d6d10' }}>
                                <span className="text-[#ff4d6d] font-medium"><i className="bi bi-exclamation-triangle" /> Destino não encontrado: {(tx as any).counterpartNameHint}</span>
                                <div className="flex gap-2 items-center">
                                  <select 
                                    className={`flex-1 rounded-sm border px-2 py-1 text-xs outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626] text-white' : 'bg-white border-zinc-200 text-black'}`} 
                                    value={tx.counterpartAccountId || ''} 
                                    onChange={e => {
                                      const val = e.target.value;
                                      setPendingTxs(prev => prev.map((p, idx) => idx === i ? { ...p, counterpartAccountId: val || null } : p));
                                    }}
                                  >
                                    <option value="">Selecione a conta/cofrinho...</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.parentAccountId ? '\u00A0\u00A0└\u00A0' : ''}{a.emoji || '🏦'} {a.name}</option>)}
                                  </select>
                                  {tx.direction === 'in' ? (
                                    <button onClick={() => setPendingTxs(prev => prev.map((p, idx) => idx === i ? { ...p, type: 'income', category: 'Outros', counterpartAccountId: null } : p))} className={`shrink-0 rounded-sm border px-2 py-1 text-[10px] font-medium text-[#75d934] border-[#75d93440] bg-[#75d93410] hover:bg-[#75d93420]`}>
                                      Tratar como Receita
                                    </button>
                                  ) : tx.direction === 'out' ? (
                                    <button onClick={() => setPendingTxs(prev => prev.map((p, idx) => idx === i ? { ...p, type: 'expense', category: 'Outros', counterpartAccountId: null } : p))} className={`shrink-0 rounded-sm border px-2 py-1 text-[10px] font-medium ${isDark ? 'bg-[#262626] border-[#333] hover:bg-[#333]' : 'bg-zinc-100 border-zinc-200 hover:bg-zinc-200'}`}>
                                      Tratar como Despesa
                                    </button>
                                  ) : (
                                    <>
                                      <button onClick={() => setPendingTxs(prev => prev.map((p, idx) => idx === i ? { ...p, type: 'income', category: 'Outros', counterpartAccountId: null } : p))} className="shrink-0 rounded-sm border px-2 py-1 text-[10px] font-medium text-[#75d934] border-[#75d93440] bg-[#75d93410] hover:bg-[#75d93420]">
                                        Receita
                                      </button>
                                      <button onClick={() => setPendingTxs(prev => prev.map((p, idx) => idx === i ? { ...p, type: 'expense', category: 'Outros', counterpartAccountId: null } : p))} className={`shrink-0 rounded-sm border px-2 py-1 text-[10px] font-medium ${isDark ? 'bg-[#262626] border-[#333] hover:bg-[#333]' : 'bg-zinc-100 border-zinc-200 hover:bg-zinc-200'}`}>
                                        Despesa
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <hr className={`my-2 ${isDark ? 'border-[#333]' : 'border-zinc-200'}`} />
                  <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <i className="bi bi-check-circle text-[#75d934]" /> <strong>{pendingTxs.length}</strong> transações identificadas. Confirme para importar.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={confirmImport} className="flex items-center gap-2 rounded-sm bg-zinc-800 px-4 py-2 font-medium text-white hover:bg-zinc-700">
                      <i className="bi bi-check-lg" /> Confirmar Importação
                    </button>
                    <button onClick={() => setPendingTxs([])} className={`flex items-center gap-2 rounded-sm border px-4 py-2 font-medium ${isDark ? 'border-[#262626] bg-[#141414] hover:bg-[#1C1C1C]' : 'border-zinc-200 bg-white hover:bg-zinc-50'}`}>
                      <i className="bi bi-arrow-clockwise" /> Tentar novamente
                    </button>
                    <button onClick={cancelImport} className={`rounded-sm border px-4 py-2 font-medium ${isDark ? 'border-[#262626] bg-[#141414] hover:bg-[#1C1C1C]' : 'border-zinc-200 bg-white hover:bg-zinc-50'}`}>Cancelar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BULK EDIT MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowBulkModal(false); }}>
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${isDark ? 'bg-[#141414] border-[#262626]' : 'bg-white border-zinc-200'}`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold"><i className="bi bi-pencil-square" /> Editar em Lote</h2>
              <button onClick={() => setShowBulkModal(false)} className="cursor-pointer text-zinc-400 hover:text-zinc-600"><i className="bi bi-x-lg" /></button>
            </div>
            <div className="flex flex-col gap-4">
              <p className={`rounded-sm border p-2.5 text-xs ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-zinc-50 border-zinc-200'}`}>
                Editando <strong className="text-[var(--accent)]">{selectedIds.length}</strong> transações. Deixe em branco os campos que não deseja alterar.
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Tipo (opcional)</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[{ v: '', l: 'Manter' }, { v: 'income', l: 'Receita' }, { v: 'expense', l: 'Despesa' }, { v: 'transfer', l: 'Transf.' }].map(t => (
                    <label key={t.v} className={`flex cursor-pointer items-center justify-center gap-[5px] rounded-sm border px-[6px] py-[9px] text-[13px] font-medium transition-all ${
                      bulkForm.type === t.v
                        ? t.v === 'income' ? 'bg-[var(--green-dim)] border-[var(--green)] text-[var(--green)]'
                          : t.v === 'expense' ? 'bg-[var(--red-dim)] border-[var(--red)] text-[var(--red)]'
                          : t.v === 'transfer' ? 'bg-[var(--blue-dim)] border-[var(--blue)] text-[var(--blue)]'
                          : 'bg-[rgb(0 0 0 / 75%)] border-[var(--text)] text-[var(--text)]'
                        : 'bg-[var(--card)] border-[var(--border)] text-[var(--text-2)]'
                    }`}>
                      <input type="radio" name="bulk-type" value={t.v} checked={bulkForm.type === t.v} onChange={e => setBulkForm({ ...bulkForm, type: e.target.value })} className="hidden" />
                      {t.l}
                    </label>
                  ))}
                </div>
              </div>

              {bulkForm.type === 'transfer' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Direção</label>
                  <div className={`flex items-center justify-between rounded-sm border px-3 py-2 text-sm font-semibold ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-zinc-50 border-zinc-200'}`}>
                    <span style={{ color: bulkForm.direction === 'out' ? '#ff4d6d' : 'var(--text-3)' }}>Saiu</span>
                    <div className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full" style={{ background: bulkForm.direction === 'in' ? '#75d934' : '#ff4d6d' }} onClick={() => setBulkForm({ ...bulkForm, direction: bulkForm.direction === 'in' ? 'out' : 'in' })}>
                      <div className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white ${bulkForm.direction === 'in' ? 'left-[23px]' : 'left-[3px]'}`} />
                    </div>
                    <span style={{ color: bulkForm.direction === 'in' ? '#75d934' : 'var(--text-3)' }}>Entrou</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Novo título (opcional)</label>
                <input type="text" className={`rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} placeholder="Deixe vazio para manter" value={bulkForm.title} onChange={e => setBulkForm({ ...bulkForm, title: e.target.value })} />
                <p className="text-[11px] text-zinc-500">Renomeia todas as transações selecionadas.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Categoria (opcional)</label>
                  <select className={`cursor-pointer rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={bulkForm.category} onChange={e => setBulkForm({ ...bulkForm, category: e.target.value, subcategory: '' })}>
                    <option value="">Manter atual</option>
                    {allCategories.map(c => <option key={c} value={c}>{categoryEmoji(c)} {c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Subcategoria (opcional)</label>
                  <select className={`cursor-pointer rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={bulkForm.subcategory} onChange={e => setBulkForm({ ...bulkForm, subcategory: e.target.value })}>
                    <option value="">Manter atual</option>
                    {getSubcategories(bulkForm.category).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Conta (opcional)</label>
                <select className={`cursor-pointer rounded-sm border px-3 py-2 text-sm outline-none ${isDark ? 'bg-[#1C1C1C] border-[#262626]' : 'bg-white border-zinc-200'}`} value={bulkForm.accountId} onChange={e => setBulkForm({ ...bulkForm, accountId: e.target.value })}>
                  <option value="">Manter atual</option>
                  <option value="__none__">Sem conta</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.emoji || '🏦'} {a.name}</option>)}
                </select>
              </div>

              <div className="mt-2 flex gap-2">
                <button onClick={saveBulkEdit} className="flex-1 cursor-pointer rounded-sm bg-[var(--accent)] px-4 py-2 font-medium text-white transition-colors hover:brightness-110"><i className="bi bi-check-all" /> Aplicar a todas</button>
                <button onClick={() => setShowBulkModal(false)} className={`cursor-pointer rounded-sm border px-4 py-2 font-medium ${isDark ? 'border-[#262626] bg-[#141414] hover:bg-[#1C1C1C]' : 'border-zinc-200 bg-white hover:bg-zinc-50'}`}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI SETUP MODAL */}
      {showAISetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAISetupModal(false); }}>
          <div className={`w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl ${isDark ? 'bg-[#141414] border-[#262626]' : 'bg-white border-zinc-200'}`}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border bg-zinc-100 text-3xl dark:border-zinc-700 dark:bg-zinc-800">
              <i className="bi bi-cpu text-zinc-600 dark:text-zinc-300" />
            </div>
            <h2 className="mb-2 text-xl font-bold">Ative a Importação com IA</h2>
            <p className="mb-4 text-sm text-zinc-500">
              A importação inteligente lê o seu extrato bancário e classifica as transações automaticamente por categoria, valor e data.
            </p>
            <p className="mb-6 text-sm text-zinc-500">
              Para usar esse recurso, configure sua chave de IA nas <strong>Configurações</strong>. Ela é criptografada e fica segura no servidor.
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setShowAISetupModal(false); router.push('/panel/settings?tab=ai'); }} className="rounded-sm bg-zinc-800 px-4 py-2 font-medium text-white cursor-pointer hover:bg-zinc-700"><i className="bi bi-gear" /> Configurar IA</button>
              <button onClick={() => setShowAISetupModal(false)} className={`rounded-sm border cursor-pointer px-4 py-2 font-medium ${isDark ? 'border-[#262626] bg-[#1C1C1C] hover:bg-[#262626]' : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100'}`}>Agora não</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
