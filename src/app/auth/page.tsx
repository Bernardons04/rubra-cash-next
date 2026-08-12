'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

  const showToast = (message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (session) {
        router.push('/panel/dashboard');
      } else {
        setLoading(false);
      }
    }
    checkSession();
  }, [router]);

  const signInWithGoogle = async () => {
    try {
      setAuthLoading(true);
      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/auth/callback',
        },
      });

      if (error) throw error;
      showToast('Redirecionando...');
    } catch (e: any) {
      showToast('Erro: ' + e.message);
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0A0A0A]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-[#a84551]" />
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-[#0A0A0A] px-4 font-sans text-[#F0F0F0] selection:bg-[#a84551]/30">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)] bg-[size:40px_40px] opacity-15" />
      
      {/* Background Radial Glow */}
      <div className="absolute top-0 right-0 left-0 -z-10 h-full w-full bg-[radial-gradient(246.6%_88.54%_at_37.12%_5.43%,transparent_56.43%,rgba(168,69,81,0.15)_80.92%,rgba(168,69,81,0.3))]" />

      <div className="z-10 w-full max-w-[400px] rounded-3xl border border-[#262626] bg-[#141414]/90 p-8 text-center shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <div className="mb-8 flex items-center justify-center gap-2.5 text-2xl font-extrabold tracking-tight">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#a84551]" />
          Rubra
          <span className="rounded-full bg-[#a84551] px-2 py-0.5 text-[11px] font-bold text-white">
            Cash
          </span>
        </div>

        <h1 className="mb-2 text-xl font-bold text-[#F0F0F0]">Bem-vindo de volta</h1>
        <p className="mb-8 text-sm leading-relaxed text-[#A3A3A3]">
          Acesse sua conta para gerenciar seus extratos com inteligência artificial.
        </p>

        <button
          onClick={signInWithGoogle}
          disabled={authLoading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-black shadow-sm transition-all duration-200 hover:scale-[0.98] hover:bg-zinc-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-75"
        >
          {authLoading ? (
            <>
              <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-zinc-300 border-t-black" />
              Autenticando...
            </>
          ) : (
            <>
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="h-5 w-5"
              />
              Continuar com Google
            </>
          )}
        </button>
      </div>

      {/* Bottom Glow */}
      <div className="pointer-events-none fixed -bottom-[150px] left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(168,69,81,0.25)_0%,transparent_70%)] blur-[80px]" />

      {/* Toasts */}
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="mb-2 rounded-xl border border-[#262626] bg-[#141414] px-6 py-3 text-sm font-medium text-[#F0F0F0] shadow-2xl"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
