'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/panel/dashboard');
      }
    });

    // Check immediately in case session is already loaded
    supabaseBrowser.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/panel/dashboard');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0A0A0A]">
      <div className="text-center text-[#F0F0F0]">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-[#a84551] mb-4" />
        <p className="text-sm font-medium text-[#A3A3A3]">Processando autenticação...</p>
      </div>
    </div>
  );
}
