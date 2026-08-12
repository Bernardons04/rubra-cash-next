'use client';

import { useState, useEffect, useRef } from 'react';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUI } from '@/context/UIContext';
import './panel.css';

const NAV_ITEMS = [
  { path: '/panel/dashboard', icon: 'bi-grid-1x2', label: 'Dashboard' },
  { path: '/panel/transactions', icon: 'bi-arrow-left-right', label: 'Transações' },
  { path: '/panel/settings', icon: 'bi-gear', label: 'Configurações' },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading, valuesHidden, theme, toggleTheme, toggleValuesHidden, logout, showConfirm } = useUI();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 868;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // PWA Logic
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }

    const isIosDevice = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    setIsIOS(isIosDevice);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandaloneMode(isStandalone);

    const handleInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  const installPWA = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    const confirmed = await showConfirm('Sair', 'Tem certeza que deseja sair da sua conta?');
    if (confirmed) {
      logout();
      if (isStandaloneMode) {
        router.push('/auth');
      }
    }
  };

  const userTriggerRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside (user menu) – removed for simplicity; menu will stay open until user toggles it again.


  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0A0A0A]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-[#a84551]" />
      </div>
    );
  }

  if (!session) return null;

  const user = session.user;
  const userAvatar = user?.user_metadata?.avatar_url;
  const userName = user?.user_metadata?.full_name || user?.email || 'Usuário';
  const userEmail = user?.email || '';

  const activeItem = NAV_ITEMS.find((item) => item.path === pathname) || {
    label: 'Rubra Cash',
    icon: 'bi-house',
  };

  return (
    <div className="panel-layout">
      {/* iOS PWA Install Banner */}
      {showIOSBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-[100] border-t bg-[var(--card)] p-4 shadow-2xl border-[var(--border)]">
          <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
            <h3 className="font-bold">Instalar App</h3>
            <p className="text-sm text-[var(--text-2)]">Para instalar o Rubra Cash no seu iPhone, toque no ícone de compartilhamento <i className="bi bi-share" /> na barra de navegação e depois em <strong>"Adicionar à Tela de Início" <i className="bi bi-plus-square" /></strong>.</p>
            <button onClick={() => setShowIOSBanner(false)} className="mt-2 w-full rounded-xl bg-[var(--surface)] py-3 font-medium hover:bg-[var(--card-hover)] text-[var(--text)]">Entendi</button>
          </div>
        </div>
      )}

      <div className="panel-content-wrapper flex min-h-screen duration-200">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && isMobile && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`aside-sidebar fixed top-0 bottom-0 left-0 z-40 flex flex-col border-r bg-[var(--surface)] border-[var(--border)] transition-all duration-200 ease-in-out text-[var(--text)]
          ${isMobile ? (sidebarOpen ? 'translate-x-0 w-[var(--sidebar-w)]' : '-translate-x-full w-[var(--sidebar-w)]') : (sidebarOpen ? 'w-[var(--sidebar-w)]' : 'w-[var(--sidebar-collapsed)]')}`}
      >
        {/* Logo Section */}
        <div className={`flex h-[65px] shrink-0 items-center justify-between border-b px-4 border-[var(--border)]`}>
          {(sidebarOpen || isMobile) ? (
            <>
              <Link href="/panel/dashboard" className="flex items-center gap-2 font-extrabold tracking-tight">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#a84551]" />
                <span className="text-lg">Rubra</span>
                <span className="rounded-full bg-[#a84551] px-2 py-0.5 text-[10px] font-bold text-white">Cash</span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className={`cursor-pointer flex h-7 w-7 items-center justify-center rounded-sm border text-[var(--text-3)] hover:text-[var(--text)] border-[var(--border)] hover:bg-[var(--card-hover)]`}
              >
                <i className="bi bi-x-lg text-xs" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-3)] hover:text-[var(--accent)]"
            >
              <div className="flex items-center cursor-pointer gap-1 font-extrabold text-lg">
                <span className="h-2 w-2 rounded-full bg-[#a84551]" />
                <span className="text-[var(--text)]">R</span>
              </div>
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 p-3 px-[10px]">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => isMobile && setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] font-medium transition-all duration-150
                  ${!sidebarOpen && !isMobile ? 'justify-center' : ''}
                  ${isActive 
                    ? 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)] border' 
                    : 'border border-transparent text-[var(--text-2)] hover:bg-[var(--card-hover)] hover:text-[var(--text)]'}
                  `}title={!sidebarOpen && !isMobile ? item.label : ''}
              >
                <i className={`bi ${item.icon} text-lg shrink-0`} />
                {(sidebarOpen || isMobile) && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer (User details & Options) */}
        <div className={`border-t p-3 px-[10px] border-[var(--border)]`}>
          <div className="relative">
            <button
              ref={userTriggerRef}
              onClick={(e) => {
                e.stopPropagation();
                setUserMenuOpen(!userMenuOpen);
              }}
              className={`flex w-full items-center gap-3 rounded-xl cursor-pointer border p-2 text-left border-[var(--border)] hover:bg-[var(--card-hover)]
                ${!sidebarOpen && !isMobile ? 'justify-center' : ''}`}
            >
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="h-[36px] w-[36px] shrink-0 rounded-[10px] object-cover" />
              ) : (
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-bold bg-[var(--surface)] border-[var(--border)] text-[var(--text-2)]`}>
                  <i className="bi bi-person-fill" />
                </div>
              )}
              {(sidebarOpen || isMobile) && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{userName}</p>
                  <p className="truncate text-[11px] text-[var(--text-3)]">{userEmail}</p>
                </div>
              )}
              {(sidebarOpen || isMobile) && (
                <i className={`bi bi-chevron-up ml-auto text-xs text-[var(--text-3)] transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
              )}
            </button>

            {/* Dropup Menu */}
            <div
              ref={userMenuRef}
              className={`absolute bottom-full left-0 z-100 mb-1 ${sidebarOpen ? 'w-full' : 'w-60'} rounded-sm border p-[2px] shadow-xl bg-[var(--surface)] border-[var(--border)] text-[var(--text-2)] transition-all duration-200 ${
                userMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-[10px] pointer-events-none'
              }`}>
                <button
                  onClick={toggleValuesHidden}
                  className={`flex w-full items-center cursor-pointer justify-between rounded-md px-3 py-2.5 text-left text-[13px] hover:bg-[var(--card-hover)] hover:text-[var(--text)]`}
                >
                  <span className="flex items-center gap-2">
                    <i className="bi bi-eye-slash" />
                    Ocultar valores
                  </span>
                  <div className={`h-5 w-9 rounded-full p-0.5 duration-200 ${valuesHidden ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                    <div className={`h-4 w-4 rounded-full bg-white transition-transform duration-200 ${valuesHidden ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </button>

                <button
                  onClick={toggleTheme}
                  className={`flex w-full items-center cursor-pointer justify-between rounded-md px-3 py-2.5 text-left text-[13px] hover:bg-[var(--card-hover)] hover:text-[var(--text)]`}
                >
                  <span className="flex items-center gap-2">
                    <i className="bi bi-moon" />
                    Tema escuro
                  </span>
                  <div className={`h-5 w-9 rounded-full p-0.5 duration-200 ${theme === 'dark' ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                    <div className={`h-4 w-4 rounded-full bg-white transition-transform duration-200 ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </button>

                {/* Install App button (PWA) will be injected here if supported */}
                {installPrompt && (
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      installPWA();
                    }}
                    className="cursor-pointer flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-[13px] hover:bg-[var(--card-hover)] hover:text-[var(--text)]"
                  >
                    <i className="bi bi-download" />
                    Instalar App
                  </button>
                )}
                {isIOS && !isStandaloneMode && (
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setShowIOSBanner(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-[13px] hover:bg-[var(--card-hover)] hover:text-[var(--text)]"
                  >
                    <i className="bi bi-phone" />
                    Instalar no iPhone
                  </button>
                )}

                <div className={`my-1 border-t border-[var(--border)]`} />

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-[13px] text-[var(--red)] hover:bg-[var(--red-dim)]"
                >
                  <i className="bi bi-box-arrow-right" />
                  Sair
                </button>
              </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex min-w-0 flex-1 flex-col transition-all duration-200 ease-in-out
        ${isMobile ? 'ml-0' : (sidebarOpen ? 'ml-[var(--sidebar-w)]' : 'ml-[var(--sidebar-collapsed)]')}`}
      >
        {/* Header */}
        <header className={`sticky top-0 z-20 flex h-[65px] items-center justify-between border-b px-6 bg-[var(--surface)] border-[var(--border)]`}
        >
          <div className="flex items-center gap-4">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                className={`flex h-9 w-9 items-center justify-center rounded-sm border text-[var(--text-2)] hover:text-[var(--accent)] border-[var(--border)] hover:bg-[var(--card-hover)]`}
              >
                <i className="bi bi-list text-lg" />
              </button>
            )}
            <h1 className="flex items-center gap-3 text-xl font-bold">
              <i className={`bi ${activeItem.icon} text-[var(--accent)]`} />
              {activeItem.label}
            </h1>
          </div>
        </header>

        {/* Content View */}
        <main className="flex-1 overflow-x-hidden p-3 md:p-6">
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}
