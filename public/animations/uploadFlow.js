/**
 * uploadFlow.js v2 — Upload → AI Processing → Transactions
 * cursor + progress bar + auto-loop + no-scroll
 */
window.UploadFlow = (function () {

  const TRANSACTIONS = [
    { icon: '💸', title: 'Salário — Empresa Principal', amount: '+R$ 4.800,00', type: 'income', cat: 'Salário', method: '💬 PIX', acc: '🏦 Banco Inter', date: '02/05' },
    { icon: '🛒', title: 'Supermercado Extra', amount: '-R$ 247,80', type: 'expense', cat: 'Alimentação', method: '🏧 Débito', acc: '🏦 Banco Inter', date: '03/05' },
    { icon: '🎬', title: 'Netflix', amount: '-R$ 55,90', type: 'expense', cat: 'Lazer', method: '💳 Crédito', acc: '💳 Nubank', date: '03/05' },
    { icon: '🚗', title: 'Uber — Corrida', amount: '-R$ 28,40', type: 'expense', cat: 'Transporte', method: '💬 PIX', acc: '🏦 Banco Inter', date: '07/05' },
    { icon: '💊', title: 'Farmácia São Paulo', amount: '-R$ 89,00', type: 'expense', cat: 'Saúde', method: '💳 Crédito', acc: '💳 Nubank', date: '10/05' },
  ];

  // ── Helpers ──
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function setProgress(cid, pct) {
    const fill = document.getElementById(`${cid}-vfill`);
    if (!fill) return;
    fill.style.width = Math.min(pct, 100) + '%';
    if (pct > 5) fill.classList.add('active');
  }

  function moveCursor(cursor, scene, targetEl) {
    if (!cursor || !scene || !targetEl) return;
    const sr = scene.getBoundingClientRect();
    const er = targetEl.getBoundingClientRect();
    const x = ((er.left + er.width / 2 - sr.left) / sr.width * 100);
    const y = ((er.top + er.height / 2 - sr.top) / sr.height * 100);
    cursor.style.left = x + '%';
    cursor.style.top = y + '%';
  }

  async function clickAt(cursor, scene, targetEl) {
    moveCursor(cursor, scene, targetEl);
    await delay(480);
    cursor.classList.add('clicking');
    await delay(300);
    cursor.classList.remove('clicking');
    await delay(120);
  }

  function buildTxItem(tx) {
    return `
      <div class="demo-tx-item" data-tx>
        <div class="demo-tx-icon">${tx.icon}</div>
        <div class="demo-tx-body">
          <div class="demo-tx-title">${tx.title}</div>
          <div class="demo-tx-meta">
            <span class="demo-tag demo-tag-cat">${tx.cat}</span>
            <span class="demo-tag demo-tag-method">${tx.method}</span>
            <span class="demo-tag demo-tag-acc">${tx.acc}</span>
            <span class="demo-tag demo-tag-date">${tx.date}</span>
          </div>
        </div>
        <div class="demo-tx-amount ${tx.type}">${tx.amount}</div>
      </div>
    `;
  }

  function buildHTML(cid) {
    return `
      <div class="demo-scene" id="${cid}-scene">
        <div class="demo-shell">
          <div class="demo-sidebar-overlay" id="${cid}-sbo" onclick="this.classList.remove('open');document.getElementById('${cid}-sb').classList.remove('open')"></div>
          <div class="demo-sidebar" id="${cid}-sb">
            <div class="demo-sidebar-logo">
              <div class="demo-logo-dot"></div><span>Rubra</span><span class="demo-logo-badge">Cash</span>
            </div>
            <div class="demo-sidebar-nav">
              <div class="demo-nav-item"><i class="bi bi-grid-1x2"></i> Dashboard</div>
              <div class="demo-nav-item active"><i class="bi bi-arrow-left-right"></i> Transações</div>
              <div class="demo-nav-item"><i class="bi bi-gear"></i> Configurações</div>
            </div>
          </div>
          <div class="demo-main">
            <div class="demo-main-header">
              <div class="demo-hamburger"><i class="bi bi-list"></i></div>
              <i class="bi bi-arrow-left-right" style="color:#a84551;font-size:13px"></i> Transações
              <span style="margin-left:auto;">
                <div class="demo-btn demo-btn-primary demo-btn-sm" id="${cid}-import-btn">
                  <i class="bi bi-robot"></i> Importar (IA)
                </div>
              </span>
            </div>
            <div class="demo-content" style="padding:0;position:relative;">

              <!-- Phase: Empty -->
              <div class="demo-section" id="${cid}-ph-empty" style="display:flex;align-items:center;justify-content:center;">
                <div class="demo-empty">
                  <i class="bi bi-cash-stack"></i>
                  <p>Nenhuma transação ainda<br><span style="font-size:10px;display:block;margin-top:2px;">Importe um extrato com IA para começar.</span></p>
                </div>
              </div>

              <!-- Phase: Transactions -->
              <div class="demo-section hidden" id="${cid}-ph-txs" style="padding:12px;">
                <div class="demo-stats-row">
                  <div class="demo-stat-pill income">
                    <div class="demo-stat-label">Receitas</div>
                    <div class="demo-stat-value">R$ 4.800,00</div>
                  </div>
                  <div class="demo-stat-pill expense">
                    <div class="demo-stat-label">Despesas</div>
                    <div class="demo-stat-value">R$ 421,10</div>
                  </div>
                </div>
                <div class="demo-date-group">Maio 2025</div>
                <div id="${cid}-tx-list"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Import Modal -->
        <div class="demo-modal-overlay" id="${cid}-modal">
          <div class="demo-modal">
            <div class="demo-modal-header">
              <div class="demo-modal-title"><i class="bi bi-robot" style="color:#a84551"></i> Importar com IA</div>
              <div class="demo-modal-close">✕</div>
            </div>
            <div class="demo-modal-body">
              <div class="demo-upload-zone" id="${cid}-upload-zone">
                <div class="demo-upload-icon"><i class="bi bi-file-earmark-text"></i></div>
                <div class="demo-upload-title">Solte seu extrato aqui</div>
                <div class="demo-upload-sub">PDF, TXT, CSV · Clique ou arraste</div>
              </div>
              <div class="demo-file-chip" id="${cid}-file-chip" style="margin-top:9px;">
                <i class="bi bi-file-earmark-check"></i> extrato_maio_2025.pdf
              </div>
              <div id="${cid}-ai-load" style="display:none;text-align:center;padding:12px 0;">
                <div class="demo-ai-icon">🤖</div>
                <div class="demo-ai-text">Processando com IA...</div>
                <div class="demo-ai-sub" id="${cid}-ai-msg" style="margin:4px 0 10px;">Lendo o extrato...</div>
                <div class="demo-progress"><div class="demo-progress-fill" id="${cid}-ai-prog"></div></div>
              </div>
              <div style="display:flex;gap:6px;margin-top:10px;" id="${cid}-modal-btns">
                <div class="demo-btn demo-btn-primary" id="${cid}-proc-btn"><i class="bi bi-robot"></i> Processar com IA</div>
                <div class="demo-btn demo-btn-ghost">Cancelar</div>
              </div>
            </div>
          </div>
        </div>

        <div class="demo-toast success" id="${cid}-toast">
          <span class="demo-toast-icon"><i class="bi bi-check-circle-fill"></i></span>
          <span>✨ 5 transações importadas!</span>
        </div>

        <!-- Cursor -->
        <div class="demo-cursor-el" id="${cid}-cursor">
          <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
            <path d="M4 1L4 21L8.5 16.5L12 24L14.5 23L11 15.5L18 15.5L4 1Z" fill="white" stroke="#1a1a1a" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <div class="demo-cursor-ripple"></div>
        </div>

        <!-- Video progress bar -->
        <div class="demo-video-bar">
          <div class="demo-video-track">
            <div class="demo-video-fill" id="${cid}-vfill"></div>
          </div>
        </div>
      </div>
    `;
  }

  async function run(cid) {
    const $ = id => document.getElementById(id);
    const scene = $(`${cid}-scene`);
    if (!scene) return;
    const cursor = $(`${cid}-cursor`);

    // Full reset
    $(`${cid}-modal`).classList.remove('open');
    $(`${cid}-ph-empty`).classList.remove('hidden');
    $(`${cid}-ph-txs`).classList.add('hidden');
    $(`${cid}-file-chip`).classList.remove('visible');
    $(`${cid}-ai-load`).style.display = 'none';
    $(`${cid}-modal-btns`).style.display = 'flex';
    $(`${cid}-ai-prog`).style.width = '0%';
    $(`${cid}-upload-zone`).classList.remove('drag-active');
    $(`${cid}-toast`).classList.remove('visible');
    $(`${cid}-tx-list`).innerHTML = '';
    setProgress(cid, 0);
    cursor.classList.remove('visible', 'clicking');

    await delay(500);

    // Show cursor
    const importBtn = $(`${cid}-import-btn`);
    moveCursor(cursor, scene, importBtn);
    cursor.classList.add('visible');
    setProgress(cid, 5);
    await delay(600);

    // Step 1: Click import — 10%
    await clickAt(cursor, scene, importBtn);
    $(`${cid}-modal`).classList.add('open');
    setProgress(cid, 12);
    await delay(600);

    // Step 2: Drag to upload zone — 25%
    const uploadZone = $(`${cid}-upload-zone`);
    moveCursor(cursor, scene, uploadZone);
    await delay(500);
    uploadZone.classList.add('drag-active');
    setProgress(cid, 25);
    await delay(500);
    cursor.classList.add('clicking');
    await delay(250);
    cursor.classList.remove('clicking');
    uploadZone.classList.remove('drag-active');
    $(`${cid}-file-chip`).classList.add('visible');
    setProgress(cid, 32);
    await delay(600);

    // Step 3: Click process — 40%
    const procBtn = $(`${cid}-proc-btn`);
    await clickAt(cursor, scene, procBtn);
    $(`${cid}-modal-btns`).style.display = 'none';
    $(`${cid}-ai-load`).style.display = 'block';
    setProgress(cid, 40);

    // Step 4: AI progress animation — 40→75%
    const msgs = ['Lendo o extrato...', 'Identificando transações...', 'Classificando categorias...', 'Finalizando...'];
    const aiProg = $(`${cid}-ai-prog`);
    const aiMsg = $(`${cid}-ai-msg`);
    for (let i = 0; i <= 100; i += 3) {
      aiProg.style.width = i + '%';
      const mi = Math.floor((i / 100) * msgs.length);
      aiMsg.textContent = msgs[Math.min(mi, msgs.length - 1)];
      setProgress(cid, 40 + (i / 100) * 35);
      await delay(45);
    }
    setProgress(cid, 76);
    await delay(250);

    // Step 5: Close modal, show transactions — 78%
    $(`${cid}-modal`).classList.remove('open');
    await delay(180);
    $(`${cid}-ph-empty`).classList.add('hidden');
    $(`${cid}-ph-txs`).classList.remove('hidden');
    setProgress(cid, 78);

    // Step 6: Transactions appear one by one — 78→95%
    const list = $(`${cid}-tx-list`);
    for (let i = 0; i < TRANSACTIONS.length; i++) {
      const tx = TRANSACTIONS[i];
      list.insertAdjacentHTML('beforeend', buildTxItem(tx));
      const items = list.querySelectorAll('[data-tx]');
      const latest = items[items.length - 1];
      latest.classList.add('processing');
      await delay(80);
      latest.classList.remove('processing');
      latest.classList.add('visible');
      setProgress(cid, 78 + ((i + 1) / TRANSACTIONS.length) * 17);
      await delay(200);
    }

    // Step 7: Toast — 97%
    setProgress(cid, 97);
    $(`${cid}-toast`).classList.add('visible');
    cursor.classList.remove('visible');
    await delay(2000);
    $(`${cid}-toast`).classList.remove('visible');

    // Complete
    setProgress(cid, 100);
    await delay(1800);

    // Loop
    run(cid);
  }

  function init(cid) {
    const container = document.getElementById(cid);
    if (!container) return;
    container.innerHTML = buildHTML(cid);
    run(cid);
  }

  return { init };
})();
