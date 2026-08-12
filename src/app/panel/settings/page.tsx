'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useUI } from '@/context/UIContext';
import { useData, Account, PromptNote } from '@/context/DataContext';
import { formatBRL, ACCOUNT_COLOR_PRESETS, PREDEFINED_CATEGORIES, uuid } from '@/lib/utils';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { useSearchParams, useRouter } from 'next/navigation';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'accounts';

  const { theme, setToast, session, showConfirm } = useUI();
  const { accounts, customCategories, aiPromptNotes, aiSettings, setAccounts, setCustomCategories, setAiPromptNotes, refreshData, refreshAISettings, transactions, setTransactions } = useData();

  const isDark = theme === 'dark';
  const currentUser = session?.user;

  const [activeSection, setActiveSection] = useState(initialTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveSection(tab);
  }, [searchParams]);

  const sections = [
    { id: 'accounts', icon: 'bi-bank', label: 'Contas' },
    { id: 'categories', icon: 'bi-tags', label: 'Categorias' },
    { id: 'notes', icon: 'bi-journal-text', label: 'Notas para IA' },
    { id: 'ai', icon: 'bi-robot', label: 'IA' },
  ];

  // Accounts
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accForm, setAccForm] = useState({ name: '', color: '#4d9fff', emoji: '🏦', anchorDate: new Date().toISOString().split('T')[0], anchorBalance: '' });

  const calcBalance = (acc: Account) => {
    const anchor = acc.anchorDate;
    const base = parseFloat(String(acc.anchorBalance)) || 0;
    let delta = 0;
    transactions.forEach(tx => {
      if (!tx.date || tx.date <= anchor) return;
      if (tx.accountId !== acc.id) return;
      if (tx.type === 'income') delta += tx.amount;
      else if (tx.type === 'expense') delta -= tx.amount;
      else if (tx.type === 'transfer') {
        if (tx.direction === 'in') delta += tx.amount;
        if (tx.direction === 'out') delta -= tx.amount;
      }
    });
    return base + delta;
  };

  const openAccountModal = (acc?: Account) => {
    setEditingAccount(acc || null);
    if (acc) {
      setAccForm({ name: acc.name, color: acc.color, emoji: acc.emoji || '🏦', anchorDate: acc.anchorDate, anchorBalance: String(acc.anchorBalance) });
    } else {
      setAccForm({ name: '', color: '#4d9fff', emoji: '🏦', anchorDate: new Date().toISOString().split('T')[0], anchorBalance: '' });
    }
    setShowAccountModal(true);
  };

  const saveAccount = async () => {
    const f = accForm;
    if (!f.name.trim()) { setToast({ message: 'Informe o nome da conta', type: 'error' }); return; }
    if (!f.anchorDate) { setToast({ message: 'Informe a data âncora', type: 'error' }); return; }
    if (f.anchorBalance === '' || isNaN(parseFloat(f.anchorBalance))) { setToast({ message: 'Informe o saldo âncora', type: 'error' }); return; }

    const accId = editingAccount?.id || uuid();
    const acc: Account = {
      id: accId,
      name: f.name.trim(), color: f.color, emoji: f.emoji,
      anchorDate: f.anchorDate, anchorBalance: parseFloat(f.anchorBalance),
    };

    let newAccs = [...accounts];
    if (editingAccount) newAccs = newAccs.map(a => a.id === accId ? acc : a);
    else newAccs.push(acc);
    setAccounts(newAccs);

    if (currentUser) {
      const payload = { name: acc.name, color: acc.color, emoji: acc.emoji, anchor_date: acc.anchorDate, anchor_balance: acc.anchorBalance, user_id: currentUser.id };
      try {
        if (editingAccount) {
          const { error } = await supabaseBrowser.from('accounts').update(payload).eq('id', acc.id);
          if (error) throw error;
        } else {
          const { error } = await supabaseBrowser.from('accounts').insert({ ...payload, id: acc.id });
          if (error) throw error;
        }
        setToast({ message: editingAccount ? 'Conta atualizada!' : 'Conta criada!', type: 'success' });
      } catch (err: any) {
        setToast({ message: 'Erro: ' + err.message, type: 'error' });
        if (!editingAccount) setAccounts(accounts.filter(a => a.id !== acc.id));
        return;
      }
    } else {
      setToast({ message: editingAccount ? 'Conta atualizada!' : 'Conta criada!', type: 'success' });
    }
    setShowAccountModal(false);
    refreshData();
  };

  const deleteAccount = async (acc: Account) => {
    const confirmed = await showConfirm('Excluir conta', `Excluir "${acc.name}"? As transações vinculadas não serão apagadas.`);
    if (!confirmed) return;
    try {
      setAccounts(accounts.filter(a => a.id !== acc.id));
      setTransactions(transactions.map(tx => tx.accountId === acc.id ? { ...tx, accountId: null } : tx));

      if (currentUser) {
        const { error } = await supabaseBrowser.from('accounts').delete().eq('id', acc.id);
        if (error) { setToast({ message: 'Erro ao excluir conta: ' + error.message, type: 'error' }); return; }
      }
      setToast({ message: 'Conta excluída', type: 'info' });
    } catch (err: any) {
      setToast({ message: 'Erro ao excluir: ' + err.message, type: 'error' });
    }
  };

  // Categories
  const [catForm, setCatForm] = useState({ name: '', subcatInput: '', subcats: [] as string[] });

  const addSubcat = () => {
    const v = catForm.subcatInput.trim();
    if (v && !catForm.subcats.includes(v)) setCatForm(prev => ({ ...prev, subcats: [...prev.subcats, v], subcatInput: '' }));
  };

  const clearCatForm = () => setCatForm({ name: '', subcatInput: '', subcats: [] });

  const editCategory = (cat: string) => {
    setCatForm({ name: cat, subcats: [...(customCategories[cat] || [])], subcatInput: '' });
  };

  const saveCategoriesToDB = async (cats: any) => {
    if (!currentUser) return;
    for (const [name, subs] of Object.entries(cats)) {
      await supabaseBrowser.from('custom_categories').upsert(
        { user_id: currentUser.id, category_name: name, subcategories: subs },
        { onConflict: 'user_id,category_name' }
      );
    }
  };

  const saveCategory = async () => {
    const name = catForm.name.trim();
    if (!name) { setToast({ message: 'Digite o nome da categoria', type: 'warning' }); return; }
    if (PREDEFINED_CATEGORIES[name]) { setToast({ message: 'Categoria já existe nas padrões', type: 'error' }); return; }
    const subs = [...catForm.subcats];

    const updated = { ...customCategories, [name]: subs };
    setCustomCategories(updated);
    if (currentUser) await saveCategoriesToDB(updated);
    setToast({ message: 'Categoria salva!', type: 'success' });
    clearCatForm();
    refreshData();
  };

  const deleteCategory = async (cat: string) => {
    const confirmed = await showConfirm('Excluir categoria', `Excluir categoria "${cat}"?`);
    if (!confirmed) return;
    try {
      const updated = { ...customCategories };
      delete updated[cat];
      setCustomCategories(updated);
      if (currentUser) {
        await supabaseBrowser.from('custom_categories').delete().eq('user_id', currentUser.id).eq('category_name', cat);
      }
      setToast({ message: 'Categoria excluída', type: 'info' });
      refreshData();
    } catch (err: any) {
      setToast({ message: 'Erro ao excluir: ' + err.message, type: 'error' });
    }
  };

  // Notes
  const [noteForm, setNoteForm] = useState({ title: '', description: '' });
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteEditForm, setNoteEditForm] = useState({ title: '', description: '' });

  const clearNoteForm = () => setNoteForm({ title: '', description: '' });

  const saveNotesToDB = async (notes: PromptNote[]) => {
    if (!currentUser) return;
    await supabaseBrowser.from('notes').delete().eq('user_id', currentUser.id);
    await supabaseBrowser.from('notes').insert(notes.map(n => ({ ...n, user_id: currentUser.id })));
  };

  const saveNote = async () => {
    const { title, description } = noteForm;
    if (!title.trim() || !description.trim()) { setToast({ message: 'Preencha título e descrição', type: 'warning' }); return; }

    const newNote = { id: uuid(), title: title.trim(), description: description.trim() };
    const updated = [...aiPromptNotes, newNote];
    setAiPromptNotes(updated);
    if (currentUser) await saveNotesToDB(updated);
    setToast({ message: 'Nota adicionada!', type: 'success' });
    clearNoteForm();
    refreshData();
  };

  const startEditNote = (note: PromptNote) => { setEditingNoteId(note.id); setNoteEditForm({ title: note.title, description: note.description }); };

  const confirmEditNote = async (note: PromptNote) => {
    const { title, description } = noteEditForm;
    if (!title.trim() || !description.trim()) { setToast({ message: 'Preencha título e descrição', type: 'warning' }); return; }

    const updated = aiPromptNotes.map(n => n.id === note.id ? { ...n, title, description } : n);
    setAiPromptNotes(updated);
    if (currentUser) await saveNotesToDB(updated);
    setToast({ message: 'Nota atualizada!', type: 'success' });
    setEditingNoteId(null);
    refreshData();
  };

  const deleteNote = async (note: PromptNote) => {
    const confirmed = await showConfirm('Excluir nota', `Excluir nota "${note.title}"?`);
    if (!confirmed) return;
    try {
      const updated = aiPromptNotes.filter(n => n.id !== note.id);
      setAiPromptNotes(updated);
      await saveNotesToDB(updated);
      setToast({ message: 'Nota excluída', type: 'info' });
      refreshData();
    } catch (err: any) {
      setToast({ message: 'Erro ao excluir: ' + err.message, type: 'error' });
    }
  };

  // AI Settings
  const aiProviders = [{ value: 'openrouter', label: 'OpenRouter', status: 'active' }, { value: 'openai', label: 'OpenAI', status: 'soon' }, { value: 'anthropic', label: 'Anthropic', status: 'soon' }, { value: 'google', label: 'Google', status: 'soon' }];
  const aiModels = [{ value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' }, { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' }, { value: 'openai/gpt-4o-mini', label: 'GPT-4o mini' }];
  const [aiForm, setAiForm] = useState({ provider: 'openrouter', model: aiModels[0].value });
  const [tempApiKey, setTempApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaveError, setAiSaveError] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    if (aiSettings) {
      setAiForm({ provider: aiSettings.provider || 'openrouter', model: aiSettings.model || aiModels[0].value });
    }
  }, [aiSettings]);

  const saveAISettings = async () => {
    setAiSaveError('');
    const isFirstSetup = !aiSettings;
    if (!aiForm.model) { setAiSaveError('Selecione um modelo.'); return; }
    if (isFirstSetup && !tempApiKey.trim()) { setAiSaveError('Informe a API Key para a configuração inicial.'); return; }

    setAiSaving(true);
    try {
      const token = session?.access_token;
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const payload: any = { provider: aiForm.provider, model: aiForm.model };
      if (tempApiKey.trim()) payload.api_key = tempApiKey.trim();

      const res = await fetch(`/api/user/ai-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      setTempApiKey('');
      setShowApiKey(false);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro do servidor (${res.status})`);
      }

      setToast({ message: 'Configurações de IA salvas!', type: 'success' });
      refreshAISettings();
    } catch (err: any) {
      setAiSaveError(err.message);
      setToast({ message: 'Erro: ' + err.message, type: 'error' });
    } finally {
      setAiSaving(false);
    }
  };

  const inputBase = `rounded-sm border px-3 py-2 text-sm outline-none bg-[var(--card)] border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)]`;
  const btnPrimary = 'flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-[var(--text-2)] uppercase tracking-[.06em] bg-[var(--accent)] text-white hover:brightness-110 cursor-pointer';
  const btnSecondary = 'flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-[var(--text-2)] uppercase tracking-[.06em] bg-[var(--card)] border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--card-hover)] hover:text-[var(--text)] cursor-pointer';
  const cardBase = `rounded-xl border p-6 bg-[var(--card)] border-[var(--border)]`;
  const surfaceItem = `flex flex-col items-start justify-between rounded-sm border p-3 bg-[var(--surface)] border-[var(--border)]`;
  const btnIconSm = 'flex px-[8px] py-[4px] cursor-pointer items-center justify-center rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--card-hover)] hover:text-[var(--text)]';
  const btnDangerSm = 'flex px-[8px] py-[4px] cursor-pointer items-center justify-center rounded-md bg-[var(--red-dim)] text-[var(--red)] hover:bg-[var(--red)] hover:text-white';

  return (
    <div className="flex flex-col gap-4">
      {/* Settings Nav — horizontal bar, like the original */}
      <nav className="flex flex-col sm:flex-row flex-wrap gap-1 rounded-xl border p-2 bg-[var(--card)] border-[var(--border)]">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => { setActiveSection(s.id); router.push(`/panel/settings?tab=${s.id}`); }}
            className={`flex flex-1 items-center justify-center gap-2.5 rounded-[var(--radius-sm)] cursor-pointer px-3 py-[10px] text-[13px] font-medium border whitespace-nowrap
              ${activeSection === s.id
                ? 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]'
                : 'border-transparent text-[var(--text-2)] hover:bg-[var(--card-hover)] hover:text-[var(--text)]'
              }
            `}
          >
            <i className={`bi ${s.icon} text-[16px] shrink-0 w-[18px] text-center`} />
            <span>{s.label}</span>
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1">
        {/* Contas */}
        {activeSection === 'accounts' && (
          <div className={cardBase}>
            <div className="mb-6">
              <h3 className="flex items-center gap-2 text-base font-bold"><i className="bi bi-bank text-[#a84551]" /> Contas <span className="rounded-full border bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">Opcional</span></h3>
              <p className="mt-1 text-[13px] text-zinc-500">Cadastre suas contas para rastrear saldos reais. Defina um saldo âncora e o app calcula automaticamente.</p>
            </div>

            {accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-[var(--text-3)]">
                <i className="bi bi-bank2 mb-3 text-4xl" />
                <p className="text-sm">Nenhuma conta cadastrada ainda.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {accounts.map(acc => (
                  <div key={acc.id} className={`${surfaceItem} flex-row`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: acc.color }} />
                      <span className="shrink-0 text-xl">{acc.emoji || '🏦'}</span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold">{acc.name}</div>
                        <div className="text-xs text-zinc-500">{formatBRL(calcBalance(acc))}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => openAccountModal(acc)} className={btnIconSm}><i className="bi bi-pencil" /></button>
                      <button onClick={() => deleteAccount(acc)} className={btnDangerSm}><i className="bi bi-trash" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => openAccountModal()} className={`${btnPrimary} mt-4`}>
              <i className="bi bi-plus-lg" /> Nova Conta
            </button>
          </div>
        )}

        {/* Categorias */}
        {activeSection === 'categories' && (
          <div className={cardBase}>
            <div className="mb-6">
              <h3 className="flex items-center gap-2 text-base font-bold"><i className="bi bi-tags text-[#a84551]" /> Categorias Personalizadas</h3>
              <p className="mt-1 text-[13px] text-zinc-500">Adicione ou edite categorias que quer usar no aplicativo.</p>
            </div>

            <div className="mb-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-[.06em]">Nome da categoria</label>
                <input type="text" className={inputBase} value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder="Ex: Finanças" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-[.06em]">Subcategorias (opcional)</label>
                <div className="flex gap-2">
                  <input type="text" className={`${inputBase} flex-1`} value={catForm.subcatInput} onChange={e => setCatForm({ ...catForm, subcatInput: e.target.value })} onKeyDown={e => e.key === 'Enter' && addSubcat()} placeholder="Ex: Corte, Barba..." />
                  <button onClick={addSubcat} className="flex items-center justify-center rounded-xl px-4 cursor-pointer bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--card-hover)] hover:text-[var(--text)]"><i className="bi bi-plus-lg" /></button>
                </div>
                {catForm.subcats.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {catForm.subcats.map((s, i) => (
                      <span key={i} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-[var(--accent)] text-black">
                        {s} <button onClick={() => setCatForm(prev => ({ ...prev, subcats: prev.subcats.filter((_, idx) => idx !== i) }))} className="text-black/70 hover:text-black">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={saveCategory} className={btnPrimary}><i className="bi bi-check-lg" /> Salvar categoria</button>
                <button onClick={clearCatForm} className={btnSecondary}><i className="bi bi-x-lg" /> Limpar</button>
              </div>
            </div>

            {Object.keys(customCategories).length === 0 ? (
              <div className="mb-4 text-[13px] text-zinc-500">Nenhuma categoria personalizada</div>
            ) : (
              <div className="mb-6 flex flex-col gap-2">
                {Object.entries(customCategories).map(([cat, subs]) => (
                  <div key={cat} className={surfaceItem}>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[13px] font-semibold">{cat}</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => editCategory(cat)} className={btnIconSm}><i className="bi bi-pencil" /></button>
                        <button onClick={() => deleteCategory(cat)} className={btnDangerSm}><i className="bi bi-trash" /></button>
                      </div>
                    </div>
                    {subs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {subs.map(s => <span key={s} className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[var(--accent-dim)] text-[var(--accent)]">{s}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h4 className="mb-2 text-[13px] font-semibold text-[var(--text-2)]">Categorias existentes (padrão)</h4>
            <div className="flex flex-col gap-2 opacity-70">
              {Object.entries(PREDEFINED_CATEGORIES).map(([cat, subs]) => (
                <div key={cat} className={surfaceItem}>
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[13px] font-semibold">{cat}</span>
                    <span className="rounded-full border border-[var(--border)] bg-transparent px-2 py-0.5 text-[10px] text-[var(--text-3)]">Padrão</span>
                  </div>
                  {subs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {subs.map(s => <span key={s} className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[var(--accent-dim)] text-[var(--accent)]">{s}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notas IA */}
        {activeSection === 'notes' && (
          <div className={cardBase}>
            <div className="mb-6">
              <h3 className="flex items-center gap-2 text-base font-bold"><i className="bi bi-journal-text text-[#a84551]" /> Bloco de notas para IA</h3>
              <p className="mt-1 text-[13px] text-zinc-500">Regras e instruções adicionais incluídas no prompt da IA para classificação de transações.</p>
            </div>

            <div className="mb-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-[.06em]">Título da nota</label>
                <input type="text" className={inputBase} value={noteForm.title} onChange={e => setNoteForm({ ...noteForm, title: e.target.value })} placeholder="Ex: Usuário X = barbearia" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-[.06em]">Descrição / Regra</label>
                <textarea className={`${inputBase} resize-y`} rows={3} value={noteForm.description} onChange={e => setNoteForm({ ...noteForm, description: e.target.value })} placeholder="Ex: Se for transação para fulano, título deve ser 'Barbearia'." />
              </div>
              <div className="flex gap-2">
                <button onClick={saveNote} className={btnPrimary}><i className="bi bi-check-lg" /> Salvar</button>
                <button onClick={clearNoteForm} className={btnSecondary}><i className="bi bi-x-lg" /> Limpar</button>
              </div>
            </div>

            {aiPromptNotes.length === 0 ? (
              <div className="text-[13px] text-[var(--text-3)]">Nenhuma nota adicionada ainda.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {aiPromptNotes.map(note => (
                  <div key={note.id} className={surfaceItem}>
                    {editingNoteId === note.id ? (
                      <div className="flex flex-col gap-2 w-full">
                        <input type="text" className={inputBase} value={noteEditForm.title} onChange={e => setNoteEditForm({ ...noteEditForm, title: e.target.value })} />
                        <textarea className={`${inputBase} resize-y`} rows={4} value={noteEditForm.description} onChange={e => setNoteEditForm({ ...noteEditForm, description: e.target.value })} />
                        <div className="flex gap-1.5">
                          <button onClick={() => confirmEditNote(note)} className="flex items-center gap-1 rounded-sm bg-[var(--accent)] py-[5px] px-[10px] text-xs text-white hover:brightness-110 cursor-pointer"><i className="bi bi-check-lg" /> Salvar</button>
                          <button onClick={() => setEditingNoteId(null)} className="flex items-center justify-center rounded-sm bg-[var(--card)] border border-[var(--border)] py-[5px] px-[10px] cursor-pointer text-xs text-[var(--text-2)] hover:bg-[var(--card-hover)] hover:text-[var(--text)]"><i className="bi bi-x-lg" /></button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-1.5 flex items-center justify-between w-full">
                          <strong className="text-[13px]">{note.title}</strong>
                          <div className="flex gap-1.5">
                            <button onClick={() => startEditNote(note)} className={btnIconSm}><i className="bi bi-pencil" /></button>
                            <button onClick={() => deleteNote(note)} className={btnDangerSm}><i className="bi bi-trash" /></button>
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-[13px] text-zinc-500">{note.description}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* IA */}
        {activeSection === 'ai' && (
          <div className={cardBase}>
            <div className="mb-6">
              <h3 className="flex items-center gap-2 text-base font-bold"><i className="bi bi-robot text-[#a84551]" /> Inteligência Artificial</h3>
              <p className="mt-1 text-[13px] text-zinc-500">Configure a inteligência artificial para importar seus extratos automaticamente. Sua chave é protegida por criptografia.</p>
            </div>

            {aiSettings ? (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[var(--green)] bg-[var(--green-dim)] p-3 text-[13px] font-medium text-[var(--green)]">
                <div className="flex items-center gap-2.5">
                  <i className="bi bi-shield-check text-base" />
                  <span>Configurado &mdash; chave <code className="rounded bg-[var(--green)]/10 px-1.5 py-0.5 font-mono text-xs">••••{aiSettings.api_key_last4}</code></span>
                </div>
                <span className="rounded-full border border-[var(--green)] bg-[var(--green)]/10 px-2 py-0.5 text-[11px] whitespace-nowrap">{aiModels.find(x => x.value === aiSettings.model)?.label || aiSettings.model}</span>
              </div>
            ) : (
              <div className="mb-6 flex items-center gap-2.5 rounded-lg border border-[var(--orange)] bg-[var(--orange-dim)] p-3 text-[13px] font-medium text-[var(--orange)]">
                <i className="bi bi-exclamation-circle text-base" />
                <span>IA não configurada. Preencha os campos abaixo.</span>
              </div>
            )}

            <hr className={`my-6 border-[var(--border)]`} />

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-[.06em]">Provider</label>
                <select className={inputBase} value={aiForm.provider} disabled>
                  {aiProviders.map(p => <option key={p.value} value={p.value} disabled={p.status !== 'active'}>{p.label}{p.status === 'soon' ? ' (em breve)' : ''}</option>)}
                </select>
                <p className="text-[11px] text-zinc-500">Mais providers em breve.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-[.06em]">Modelo</label>
                <select className={`cursor-pointer ${inputBase}`} value={aiForm.model} onChange={e => setAiForm({ ...aiForm, model: e.target.value })}>
                  <option value="">Selecione um modelo</option>
                  {aiModels.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <p className="text-[11px] text-zinc-500">Escolha o modelo que deseja utilizar.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-[.06em] flex items-center gap-2">
                    API Key
                    {aiSettings && <span className="text-[10px] font-normal text-zinc-500">(deixe vazio para manter a atual)</span>}
                  </label>
                  <button onClick={() => setShowHelpModal(true)} className="cursor-pointer flex items-center gap-1 text-[11px] font-semibold text-zinc-800 hover:underline dark:text-zinc-200"><i className="bi bi-question-circle" /> Como conseguir?</button>
                </div>
                <div className="relative">
                  <input type={showApiKey ? 'text' : 'password'} className={`${inputBase} w-full pr-10`} value={tempApiKey} onChange={e => setTempApiKey(e.target.value)} placeholder="sk-or-v1-..." autoComplete="new-password" />
                  <button onClick={() => setShowApiKey(!showApiKey)} className="cursor-pointer absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400 hover:text-zinc-600" title={showApiKey ? 'Ocultar' : 'Revelar'}>
                    <i className={showApiKey ? 'bi bi-eye-slash' : 'bi bi-eye'} />
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Obtenha sua chave em <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" className="font-medium hover:underline dark:text-zinc-300">openrouter.ai/keys</a>. A chave é criptografada e nunca trafega de volta ao app.
                </p>
              </div>

              {aiSaveError && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#ff4d6d] bg-[#ff4d6d1f] p-2.5 text-[13px] text-[#ff4d6d]">
                  <i className="bi bi-x-circle" /> {aiSaveError}
                </div>
              )}

              <button onClick={saveAISettings} disabled={aiSaving} className={`${btnPrimary} mt-2 w-max disabled:opacity-50`}>
                <i className="bi bi-check-lg" /> {aiSaving ? 'Salvando...' : (aiSettings ? 'Atualizar Configurações' : 'Salvar e Ativar')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAccountModal(false); }}>
          <div className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl bg-[var(--card)] border-[var(--border-soft)]`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingAccount ? 'Editar Conta' : 'Nova Conta'}</h2>
              <button onClick={() => setShowAccountModal(false)} className="text-[var(--text-3)] cursor-pointer hover:text-[var(--text)]"><i className="bi bi-x-lg" /></button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-[.06em]">Nome da conta</label>
                <input type="text" className={inputBase} value={accForm.name} onChange={e => setAccForm({ ...accForm, name: e.target.value })} placeholder="Ex: Banco Inter, Mercado Pago..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-[.06em]">Cor de identificação</label>
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-8 w-8 cursor-pointer rounded border-0 p-0" value={accForm.color} onChange={e => setAccForm({ ...accForm, color: e.target.value })} />
                    <div className="flex flex-wrap gap-1">
                      {ACCOUNT_COLOR_PRESETS.map(c => (
                        <button key={c} onClick={() => setAccForm({ ...accForm, color: c })} className="cursor-pointer h-5 w-5 rounded-full transition-transform hover:scale-110" style={{ background: c, outline: accForm.color === c ? '2px solid currentColor' : 'none', outlineOffset: 2 }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-[.06em]">Emoji / Ícone</label>
                  <select className={`cursor-pointer ${inputBase}`} value={accForm.emoji} onChange={e => setAccForm({ ...accForm, emoji: e.target.value })}>
                    <option value="🏦">🏦 Banco</option>
                    <option value="💳">💳 Cartão</option>
                    <option value="💰">💰 Dinheiro</option>
                    <option value="📈">📈 Investimento</option>
                    <option value="💎">💎 Premium</option>
                    <option value="📱">📱 App/Digital</option>
                    <option value="🪙">🪙 Poupança</option>
                    <option value="🏪">🏪 Comercial</option>
                  </select>
                </div>
              </div>
              <hr className={`my-2 ${isDark ? 'border-[#262626]' : 'border-zinc-200'}`} />
              <p className="text-[13px] text-zinc-500"><strong>Saldo âncora:</strong> informe seu saldo atual. O app calcula o saldo real somando/subtraindo transações a partir desta data.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-[.06em]">Data âncora</label>
                  <input type="date" className={inputBase} value={accForm.anchorDate} onChange={e => setAccForm({ ...accForm, anchorDate: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-[.06em]">Saldo nesta data (R$)</label>
                  <input type="number" step="0.01" className={inputBase} value={accForm.anchorBalance} onChange={e => setAccForm({ ...accForm, anchorBalance: e.target.value })} placeholder="0,00" />
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={saveAccount} className="flex-1 rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white hover:brightness-110 cursor-pointer"><i className="bi bi-check-lg" /> Salvar Conta</button>
                <button onClick={() => setShowAccountModal(false)} className={`rounded-xl border px-4 py-2 font-medium border-[var(--border)] bg-[var(--card)] cursor-pointer text-[var(--text-2)] hover:bg-[var(--card-hover)] hover:text-[var(--text)]`}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowHelpModal(false); }}>
          <div className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl bg-[var(--card)] border-[var(--border-soft)]`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold"><i className="bi bi-robot" /> Conectar IA</h2>
              <button onClick={() => setShowHelpModal(false)} className=" cursor-pointer text-[var(--text-3)] hover:text-[var(--text)]"><i className="bi bi-x-lg" /></button>
            </div>
            <div className="flex flex-col gap-4">
              <p className="text-[13px] text-zinc-500">O Rubra Cash realiza a importação inteligente e, para isso, você conecta sua própria conta do <strong>OpenRouter</strong>. É seguro, privado e opcional.</p>
              
              <div className="flex flex-col gap-4">
                <div className="flex gap-3 items-start">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-xs text-[var(--text)] border border-[var(--border)]"><i className="bi bi-person-plus" /></div>
                  <div>
                    <strong className="text-[13px]">1. Crie sua conta</strong>
                    <p className="mt-0.5 text-xs text-[var(--text-2)]">Acesse <a href="https://openrouter.ai" target="_blank" rel="noopener" className="font-medium hover:underline text-[var(--accent)]">openrouter.ai</a> e crie uma conta gratuita.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-xs text-[var(--text)] border border-[var(--border)]"><i className="bi bi-key" /></div>
                  <div>
                    <strong className="text-[13px]">2. Gere sua chave</strong>
                    <p className="mt-0.5 text-xs text-[var(--text-2)]">Vá na aba <strong>Keys</strong>, clique em <strong>Create Key</strong> e dê um nome.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-xs text-[var(--text)] border border-[var(--border)]"><i className="bi bi-clipboard-check" /></div>
                  <div>
                    <strong className="text-[13px]">3. Cole no aplicativo</strong>
                    <p className="mt-0.5 text-xs text-[var(--text-2)]">Copie o código gerado e cole no campo de API Key.</p>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex gap-2">
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white hover:brightness-110">
                  <i className="bi bi-box-arrow-up-right" /> Criar Chave
                </a>
                <button onClick={() => setShowHelpModal(false)} className={`rounded-xl border px-4 py-2 font-medium border-[var(--border)] bg-[var(--card)] text-[var(--text-2)] hover:bg-[var(--card-hover)] cursor-pointer hover:text-[var(--text)]`}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-[#a84551]" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}
