'use client';
import './landing.css';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { User } from '@supabase/supabase-js';

export default function LandingPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const yearRef = useRef<HTMLSpanElement>(null);
  const scriptsDone = useRef(false);

  // ── Init ──────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('rubracash-theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const t = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(t);

    if (yearRef.current) yearRef.current.textContent = String(new Date().getFullYear());

    supabaseBrowser.auth.getSession().then(({ data: { session } }) => {
      if (session) setUser(session.user);
    });

    // Scroll animations
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });
    document.querySelectorAll('.fade-up').forEach(el => obs.observe(el));

    // Particle init
    const pc = document.getElementById('data-particles');
    if (pc && pc.children.length === 0) {
      for (let i = 0; i < 25; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = Math.random() * 100 + '%';
        p.style.setProperty('--d', (3 + Math.random() * 5) + 's');
        p.style.animationDelay = Math.random() * 5 + 's';
        pc.appendChild(p);
      }
    }

    // Demo state init
    if (!(window as any).INT_DEMOS_STATE) {
      (window as any).INT_DEMOS_STATE = { upload: false, accounts: false, categories: false, ai: false };
    }
    (window as any).switchIntDemo = function (key: string) {
      document.querySelectorAll('.int-nav-item').forEach(n => n.classList.remove('active'));
      const navEl = document.getElementById('int-nav-' + key);
      if (navEl) navEl.classList.add('active');
      document.querySelectorAll('.int-demos-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById('int-panel-' + key);
      if (panel) panel.classList.add('active');

      const st = (window as any).INT_DEMOS_STATE;
      if (!st[key]) {
        st[key] = true;
        const flows: Record<string, string> = {
          upload: 'UploadFlow',
          accounts: 'AccountsFlow',
          categories: 'CategoriesFlow',
          ai: 'AINotesFlow'
        };
        const targets: Record<string, string> = {
          upload: 'demo-upload',
          accounts: 'demo-accounts',
          categories: 'demo-categories',
          ai: 'demo-ai'
        };
        setTimeout(() => {
          const flowCls = (window as any)[flows[key]];
          if (flowCls) flowCls.init(targets[key]);
        }, 80);
      }
    };

    return () => obs.disconnect();
  }, []);

  function applyTheme(t: 'light' | 'dark') {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('rubracash-theme', t);
  }

  function toggleTheme() {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }

  function showToast(msg: string) {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }

  async function signInWithGoogle() {
    try {
      setAuthLoading(true);
      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/auth/callback' },
      });
      if (error) throw error;
      showToast('Redirecionando...');
    } catch (e: any) {
      showToast('Erro: ' + e.message);
      setAuthLoading(false);
    }
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  }

  // ── FAQ ───────────────────────────────────────────────────────
  function toggleFaq(e: React.MouseEvent<HTMLDivElement>) {
    const item = e.currentTarget.parentElement!;
    const body = item.querySelector<HTMLElement>('.faq-body')!;
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => {
      i.classList.remove('open');
      (i.querySelector('.faq-body') as HTMLElement).style.maxHeight = '0px';
    });
    if (!isOpen) {
      item.classList.add('open');
      body.style.maxHeight = body.scrollHeight + 'px';
    }
  }

  // ── Init demos after scripts load ─────────────────────────────
  function initDemos() {
    if (scriptsDone.current) return;
    scriptsDone.current = true;
    // Intersection Observer to lazy-init upload demo
    const sec = document.getElementById('demos-section');
    if (!sec) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setTimeout(() => {
          (window as any).UploadFlow?.init('demo-upload');
          if ((window as any).INT_DEMOS_STATE) {
            (window as any).INT_DEMOS_STATE.upload = true;
          }
        }, 200);
        obs.disconnect();
      }
    }, { threshold: 0.15 });
    obs.observe(sec);
  }

  return (
    <>
      {/* Animation CSS */}
      <link rel="stylesheet" href="/animations/animations.css" />

      {/* Animation Scripts — loaded after page */}
      <Script src="/animations/uploadFlow.js" strategy="lazyOnload" onLoad={initDemos} />
      <Script src="/animations/accountsFlow.js" strategy="lazyOnload" />
      <Script src="/animations/categoriesFlow.js" strategy="lazyOnload" />
      <Script src="/animations/aiNotesFlow.js" strategy="lazyOnload" />

      <div data-theme={theme} style={{ fontFamily: 'var(--sans)', background: 'var(--bg)', color: 'var(--ink)' }} suppressHydrationWarning>

        {/* ── HEADER ──────────────────────────────────────── */}
        <header className="lp-header">
          <div className="wrap">
            <div className="header-inner">
              <a href="/" className="logo">
                <div className="logo-dot" />
                <span>Rubra</span><span className="logo-ai">Cash</span>
              </a>
              <nav className="desktop-nav">
                <button className="nav-link" onClick={() => scrollToSection('inicio')}>Início</button>
                <button className="nav-link" onClick={() => scrollToSection('demos-section')}>Funcionalidades</button>
                <button className="nav-link" onClick={() => scrollToSection('seguranca')}>Segurança</button>
                <button className="nav-link" onClick={() => scrollToSection('faq')}>Dúvidas</button>
              </nav>
              <div className="header-right">
                <button className="theme-toggle" onClick={toggleTheme} aria-label="Alternar tema">
                  {theme === 'dark' ? '☀️' : '🌙'}
                </button>
                {user ? (
                  <div style={{ position: 'relative' }}>
                    <button
                      className="btn btn-ghost dropdown-toggle"
                      style={{ padding: '8px' }}
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      onBlur={() => setTimeout(() => setUserMenuOpen(false), 200)}
                    >
                      {user.user_metadata?.avatar_url && (
                        <img src={user.user_metadata.avatar_url} alt="avatar" style={{ width: 32, height: 32, borderRadius: 8 }} referrerPolicy="no-referrer" />
                      )}
                      <span className="user-name">{(user.user_metadata?.full_name || user.email || '').split(' ')[0]}</span>
                    </button>
                    <div className={`dropdown-menu ${userMenuOpen ? 'open' : ''}`}>
                      <button className="dropdown-item" onClick={() => router.push('/panel/dashboard')}>Abrir app</button>
                      <button className="dropdown-item" style={{ color: 'rgb(239 68 68)' }} onClick={async () => {
                        await supabaseBrowser.auth.signOut();
                        setUser(null);
                        setUserMenuOpen(false);
                      }}>Sair</button>
                    </div>
                  </div>
                ) : (
                  <button className="btn btn-danger" onClick={() => setShowModal(true)}>Entrar</button>
                )}
                <button className="hamburger-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Menu">☰</button>
              </div>
            </div>
          </div>
        </header>

        {/* ── MOBILE MENU ─────────────────────────────────── */}
        <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <button className="close-menu-btn" onClick={() => setMobileMenuOpen(false)}>✕</button>
          {['inicio', 'demos-section', 'seguranca', 'faq'].map((id, i) => (
            <button key={id} className="mobile-link" onClick={() => scrollToSection(id)}>
              {['Início', 'Funcionalidades', 'Segurança', 'Dúvidas'][i]}
            </button>
          ))}
        </div>

        <main>
          <div className="start-sections">

            {/* ── HERO ──────────────────────────────────────── */}
            <section id="inicio" className="hero">
              <div className="wrap">
                <div className="hero-inner">
                  <div className="hero-text">
                    <div className="hero-badge"><span className="hero-badge-dot" />Organização financeira sem esforço</div>
                    <h1 className="hero-title">Seus extratos<br /><em>finalmente</em><br />fazem sentido.</h1>
                    <p className="hero-desc">Transforme PDFs, CSVs, TXTs ou OFXs confusos em insights claros. Organize meses de finanças em segundos, sem precisar compartilhar suas senhas bancárias.</p>
                    <div className="hero-actions">
                      <button className="btn btn-rubra btn-xl" onClick={() => setShowModal(true)}>Começar Gratuitamente</button>
                      <button className="btn btn-ghost btn-lg" onClick={() => scrollToSection('demos-section')}>Ver demos ↓</button>
                    </div>
                  </div>
                  <div className="hero-visual">
                    <div className="hero-visual-inner">
                      <div className="data-particles" id="data-particles" />
                      <div className="hero-tilt-container fade-up" id="hero-tilt-card">
                        <div className="snake-border-wrapper">
                          <div className="browser-mockup">
                            <div className="browser-header">
                              <div className="browser-dots"><span /><span /><span /></div>
                              <div className="browser-address">app.rubracash.com</div>
                            </div>
                            <div className="browser-body">
                              <img src="/dashboard-preview.png" alt="Rubra Cash Dashboard" className="dashboard-img" width={724} height={408} loading="lazy" />
                            </div>
                          </div>
                        </div>
                        <div className="floating-ui-element ui-processing" style={{ animationDelay: '0.5s' }}>
                          <div className="ui-status"><div className="status-pulse" /><span>IA Processando...</span></div>
                          <div className="ui-progress-bar"><div className="ui-progress-fill" /></div>
                          <div className="ui-log">Identificando 12 transações</div>
                        </div>
                        <div className="floating-ui-element ui-categorized" style={{ animationDelay: '-3s' }}>
                          <div className="ui-tx-info">
                            <span className="ui-tx-raw">PGTO PIX *IFOOD 12938</span>
                            <div className="ui-ai-tag"><span className="ai-spark">✨</span><span className="ai-label">Alimentação</span></div>
                          </div>
                          <div className="ui-tx-amount neg">-R$ 84,90</div>
                        </div>
                      </div>
                      <div className="hero-glow" />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ── DEMOS ─────────────────────────────────────── */}
            <section className="sec interactive-section" id="demos-section">
              <div className="aurora-dots">
                {[['8%', '20%', '.4s'], ['22%', '75%', '1.2s'], ['45%', '12%', '.8s'], ['60%', '55%', '2s'], ['75%', '30%', '.2s'], ['88%', '80%', '1.6s']].map(([l, t, d], i) => (
                  <div key={i} className="aurora-dot" style={{ left: l, top: t, animationDelay: d }} />
                ))}
              </div>
              <div className="wrap">
                <div className="fade-up">
                  <div className="sec-label">O produto</div>
                  <h2 className="sec-title">Cada detalhe pensado<br />para ser simples.</h2>
                  <p className="sec-sub">Explore as funcionalidades do Rubra Cash clicando abaixo.</p>
                </div>
                <div className="interactive-grid fade-up">
                  <div className="int-sidebar">
                    <div className="int-sidebar-label">Funcionalidades</div>
                    {[
                      { key: 'upload', icon: '📤', label: 'Upload do extrato' },
                      { key: 'accounts', icon: '🏦', label: 'Contas' },
                      { key: 'categories', icon: '🏷️', label: 'Categorias' },
                      { key: 'ai', icon: '🧠', label: 'Notas para IA' },
                    ].map(({ key, icon, label }) => (
                      <button key={key} id={`int-nav-${key}`} className={`int-nav-item${key === 'upload' ? ' active' : ''}`}
                        onClick={() => {
                          if (typeof (window as any).switchIntDemo === 'function') {
                            (window as any).switchIntDemo(key);
                          }
                        }}
                      >
                        <span className="int-nav-icon">{icon}</span>{label}
                      </button>
                    ))}
                  </div>
                  <div className="int-demos-content">
                    {[
                      { key: 'upload', title: 'Upload do extrato', desc: 'Arraste o PDF do seu banco ou cole o texto direto. A IA lida com qualquer layout de extrato brasileiro — sem configuração prévia.' },
                      { key: 'accounts', title: 'Contas', desc: 'Cadastre suas contas bancárias com cor, emoji e saldo âncora. O Rubra Cash calcula o saldo real automaticamente — sem depender do extrato do banco.' },
                      { key: 'categories', title: 'Categorias personalizadas', desc: 'Crie categorias e subcategorias únicas para o seu estilo de vida. O sistema aprende com seus ajustes e sugere automaticamente nas próximas importações.' },
                      { key: 'ai', title: 'Notas para IA', desc: 'Escreva instruções em linguagem natural. A IA aplica suas regras automaticamente em cada importação — sem configurar nada técnico.' },
                    ].map(({ key, title, desc }) => (
                      <div key={key} id={`int-panel-${key}`} className={`int-demos-panel${key === 'upload' ? ' active' : ''}`}>
                        <div className="int-demos-panel-info">
                          <h3 className="int-panel-title">{title}</h3>
                          <p className="int-panel-desc">{desc}</p>
                        </div>
                        <div className="int-demos-frame">
                          <div id={`demo-${key}`} style={{ height: '100%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ── FEATURES ────────────────────────────────────── */}
          <section className="sec features-section">
            <div className="wrap">
              <div className="fade-up">
                <div className="sec-label">Por que usar</div>
                <h2 className="sec-title">O essencial,<br />sem o supérfluo.</h2>
              </div>
              <div className="features-grid fade-up">
                {[
                  { icon: '⚡', title: 'Upload e pronto', desc: 'Envie o extrato e o Rubra Cash cuida do resto. Sem configuração, sem tutorial, sem precisar entender o que "PGTO PIX CHAVE ALEAT" significa.' },
                  { icon: '🎯', title: 'Categorização precisa', desc: 'A IA reconhece supermercados, assinaturas, transporte, saúde e dezenas de outras categorias. E você pode ajustar o que quiser.' },
                  { icon: '🏦', title: 'Qualquer banco do Brasil', desc: 'Itaú, Bradesco, Nubank, C6, Santander, Inter, Caixa — funciona com qualquer extrato, sem integração, sem senha.' },
                  { icon: '🔒', title: 'Seus dados, seus', desc: 'Não conectamos na sua conta bancária. Você envia só o arquivo que quiser, quando quiser. Nada além disso.' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="feature-item">
                    <div className="feature-icon">{icon}</div>
                    <h3 className="feature-title">{title}</h3>
                    <p className="feature-desc">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── SEGURANÇA ───────────────────────────────────── */}
          <section className="sec seguranca-section" id="seguranca">
            <div className="wrap">
              <div className="fade-up" style={{ textAlign: 'center' }}>
                <div className="sec-label" style={{ justifyContent: 'center' }}>Privacidade &amp; Segurança</div>
                <h2 className="sec-title">Seus dados nunca saem<br />do seu controle.</h2>
                <p className="sec-sub" style={{ margin: '0 auto' }}>Ao contrário dos apps tradicionais, o Rubra Cash não pede sua senha bancária. Apenas o extrato que você quiser enviar.</p>
              </div>
              <div className="seguranca-grid fade-up">
                {[
                  { icon: '🚫', title: 'Zero Integração Bancária', desc: 'Nós não conectamos ao seu banco. Não pedimos token, senha ou chave PIX.' },
                  { icon: '🛡️', title: 'Upload Sob Demanda', desc: 'Você envia seu PDF, OFX ou CSV manualmente, quando sentir necessidade.' },
                  { icon: '🔒', title: 'Dados Criptografados', desc: 'Suas informações de leitura do extrato ficam isoladas e restritas ao seu usuário.' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="seguranca-card">
                    <div className="seguranca-icon">{icon}</div>
                    <div className="seguranca-text"><h4>{title}</h4><p>{desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── FAQ ─────────────────────────────────────────── */}
          <section className="sec faq-section" id="faq">
            <div className="wrap">
              <div className="fade-up">
                <div className="sec-label">Dúvidas Frequentes</div>
                <h2 className="sec-title">Perguntas sobre o Rubra Cash</h2>
              </div>
              <div className="faq-list fade-up">
                {[
                  { q: 'Quais formatos de arquivo vocês aceitam?', a: 'Atualmente processamos PDF, OFX, CSV e TXT exportados de qualquer banco brasileiro (Itaú, Nubank, Bradesco, Santander, etc).' },
                  { q: 'Vocês têm acesso ao meu banco?', a: 'Não. O Rubra Cash não se conecta ao seu banco. Você decide o que compartilhar fazendo o upload manual dos seus extratos.' },
                  { q: 'Quanto custa usar o Rubra Cash?', a: 'O acesso à plataforma é 100% gratuito durante o MVP. Para as análises de IA, você integra sua própria chave de API.' },
                  { q: 'A IA vai ler meus dados com precisão?', a: 'Nossa inteligência artificial foi treinada para entender os padrões dos bancos brasileiros, categorizando perfeitamente termos como "PGTO PIX CHAVE ALEAT". Caso haja erro, você pode corrigir manualmente no painel.' },
                ].map(({ q, a }) => (
                  <div key={q} className="faq-item">
                    <div className="faq-header" onClick={toggleFaq}>
                      <h3 className="faq-question">{q}</h3>
                      <span className="faq-icon">+</span>
                    </div>
                    <div className="faq-body" style={{ maxHeight: 0 }}>
                      <p className="faq-answer">{a}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── CTA ─────────────────────────────────────────── */}
          <section className="cta-section">
            <div className="cta-top-line" />
            <div className="wrap">
              <div className="cta-inner fade-up">
                <div className="cta-tag">Grátis para começar</div>
                <h2 className="cta-title">Entenda seus gastos<br />de uma vez por todas.</h2>
                <p className="cta-desc">Faça upload do primeiro extrato agora. Sem cartão de crédito.</p>
                <div className="cta-actions">
                  <button className="btn btn-rubra btn-xl" onClick={() => setShowModal(true)}>Começar agora — é grátis</button>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* ── FOOTER ──────────────────────────────────────── */}
        <footer className="footer">
          <div className="wrap">
            <div className="footer-top">
              <div className="footer-left"><span className="footer-logo">Rubra Cash</span></div>
              <div className="footer-right">Dúvidas? <a href="mailto:rubracash@gmail.com" className="footer-link">rubracash@gmail.com</a></div>
            </div>
            <div className="footer-bottom">
              <span className="footer-copy">© <span ref={yearRef} /> — Organização financeira inteligente</span>
            </div>
          </div>
        </footer>

        {/* ── AUTH MODAL ──────────────────────────────────── */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="lp-modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Entrar no Rubra Cash</h5>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-3)' }}>✕</button>
              </div>
              <div className="modal-body">
                <p className="modal-sub">Crie sua conta para começar a organizar seus extratos.</p>
                <button className="google-btn" onClick={signInWithGoogle} disabled={authLoading}>
                  {authLoading ? (
                    <><span className="spinner" />&nbsp;Autenticando...</>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 18 18">
                        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
                        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                        <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" />
                      </svg>
                      Continuar com Google
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TOASTS ──────────────────────────────────────── */}
        <div style={{ position: 'fixed', top: 22, right: 22, zIndex: 9999 }}>
          {toasts.map(t => (
            <div key={t.id} className="toast">{t.msg}</div>
          ))}
        </div>

      </div>
    </>
  );
}