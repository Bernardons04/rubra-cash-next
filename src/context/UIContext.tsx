'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { Session } from '@supabase/supabase-js';

export interface ToastInfo {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface UIContextProps {
  theme: 'light' | 'dark';
  valuesHidden: boolean;
  session: Session | null;
  loading: boolean;
  toast: ToastInfo | null;
  toggleTheme: () => void;
  toggleValuesHidden: () => void;
  setToast: (toast: ToastInfo | null) => void;
  showConfirm: (title: string, message: string) => Promise<boolean>;
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'warning' | 'info') => Promise<void>;
  logout: () => Promise<void>;
}

const UIContext = createContext<UIContextProps | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [valuesHidden, setValuesHidden] = useState<boolean>(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. Carregar configurações do localStorage
    const savedTheme = localStorage.getItem('rubracash-theme') as 'light' | 'dark' | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const activeTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    setTheme(activeTheme);
    document.documentElement.setAttribute('data-theme', activeTheme);
    if (activeTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const savedHidden = localStorage.getItem('rubracash-values-hidden') === 'true';
    setValuesHidden(savedHidden);

    // 2. Carregar e monitorar a sessão do Supabase
    supabaseBrowser.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession);
      setLoading(false);
      if (!activeSession && pathname.startsWith('/panel')) {
        router.push('/auth');
      }
    });

    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((event, activeSession) => {
      setSession(activeSession);
      setLoading(false);
      if (!activeSession && pathname.startsWith('/panel')) {
        router.push('/auth');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('rubracash-theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleValuesHidden = () => {
    const nextHidden = !valuesHidden;
    setValuesHidden(nextHidden);
    localStorage.setItem('rubracash-values-hidden', String(nextHidden));
  };

  const logout = async () => {
    // We remove the confirm from here, as handleLogout in layout will call showConfirm
    await supabaseBrowser.auth.signOut();
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone);
    if (isPWA) {
      router.push('/auth');
    } else {
      router.push('/');
    }
  };

  const [toast, setToast] = useState<ToastInfo | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; resolve: (val: boolean) => void } | null>(null);

  const showConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({ title, message, resolve });
    });
  };

  const handleConfirm = (val: boolean) => {
    if (confirmDialog) {
      confirmDialog.resolve(val);
      setConfirmDialog(null);
    }
  };

  const [alertDialog, setAlertDialog] = useState<{ title: string; message: string; type: 'success' | 'error' | 'warning' | 'info'; resolve: () => void } | null>(null);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): Promise<void> => {
    return new Promise((resolve) => {
      setAlertDialog({ title, message, type, resolve });
    });
  };

  const handleAlertClose = () => {
    if (alertDialog) {
      alertDialog.resolve();
      setAlertDialog(null);
    }
  };

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  return (
    <UIContext.Provider
      value={{
        theme,
        valuesHidden,
        session,
        loading,
        toast,
        toggleTheme,
        toggleValuesHidden,
        setToast,
        showConfirm,
        showAlert,
        logout,
      }}
    >
      {children}
      
      {/* Global Confirm Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-[4px]" onClick={(e) => { if (e.target === e.currentTarget) handleConfirm(false); }}>
          <div className="w-full max-w-[350px] rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--card)] p-[28px] shadow-[var(--shadow-lg)]">
            <h4 className="mb-2 text-[17px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>{confirmDialog.title}</h4>
            <p className="mb-5 text-[13px] text-[var(--text-2)]">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => handleConfirm(false)} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-[10px] py-[5px] text-[12px] font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-soft)] hover:bg-[var(--card-hover)] hover:text-[var(--text)]">Cancelar</button>
              <button onClick={() => handleConfirm(true)} className="rounded-[var(--radius-sm)] border border-transparent bg-[var(--red-dim)] px-[10px] py-[5px] text-[12px] font-medium text-[var(--red)] transition-colors hover:bg-[var(--red)] hover:text-white">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Global Alert Modal */}
      {alertDialog && (
        <div className="fixed inset-0 z-[2001] flex items-center justify-center bg-black/80 backdrop-blur-[4px]">
          <div className="w-full max-w-[380px] rounded-2xl border border-[var(--border-soft)] bg-[var(--card)] p-8 shadow-2xl flex flex-col items-center text-center">
            <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
              alertDialog.type === 'success' ? 'bg-[#1a2e1a] text-[#75d934]' :
              alertDialog.type === 'error'   ? 'bg-[#2e1a1a] text-[#ff4d6d]' :
              alertDialog.type === 'warning' ? 'bg-[#2e2a1a] text-[#f5a623]' :
                                               'bg-[#1a1a2e] text-[#4d9fff]'
            }`}>
              <i className={`bi ${
                alertDialog.type === 'success' ? 'bi-check-circle-fill' :
                alertDialog.type === 'error'   ? 'bi-x-circle-fill' :
                alertDialog.type === 'warning' ? 'bi-exclamation-triangle-fill' :
                                                 'bi-info-circle-fill'
              }`} />
            </div>
            <h4 className="mb-2 text-[18px] font-bold text-[var(--text)]">{alertDialog.title}</h4>
            <p className="mb-6 text-[13px] leading-relaxed text-[var(--text-2)]">{alertDialog.message}</p>
            <button
              onClick={handleAlertClose}
              className={`w-full rounded-xl px-6 py-2.5 text-sm font-semibold transition-all hover:brightness-110 ${
                alertDialog.type === 'success' ? 'bg-[#75d934] text-black' :
                alertDialog.type === 'error'   ? 'bg-[#ff4d6d] text-white' :
                alertDialog.type === 'warning' ? 'bg-[#f5a623] text-black' :
                                                 'bg-[#4d9fff] text-white'
              }`}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI deve ser utilizado dentro de um UIProvider');
  }
  return context;
}
