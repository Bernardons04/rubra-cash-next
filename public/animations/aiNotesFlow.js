/**
 * aiNotesFlow.js v2 — AI Notes + Import with Rules
 * cursor + progress bar + auto-loop + no-scroll
 */
window.AINotesFlow = (function () {

  const NOTE_TITLE = 'Barbearia do João';
  const NOTE_DESC = 'Se a transação for "JOAO S" ou "JOAO SILVA", nomear como "Barbearia do João" e categorizar em "Beleza".';

  const TRANSACTIONS = [
    { icon: '💅', title: 'Barbearia do João', amount: '-R$ 45,00', type: 'expense', cat: 'Beleza', sub: 'Barbearia', method: '💬 PIX', aiApplied: true, date: '07/05' },
    { icon: '🛒', title: 'Supermercado Pão de Açúcar', amount: '-R$ 312,50', type: 'expense', cat: 'Alimentação', method: '🏧 Débito', aiApplied: false, date: '08/05' },
    { icon: '💸', title: 'Salário — Freelance', amount: '+R$ 2.500,00', type: 'income', cat: 'Salário', method: '🔄 TED', aiApplied: false, date: '08/05' },
    { icon: '💅', title: 'Barbearia do João', amount: '-R$ 45,00', type: 'expense', cat: 'Beleza', method: '💬 PIX', aiApplied: true, date: '09/05' },
    { icon: '🚗', title: 'Uber — Corrida', amount: '-R$ 22,80', type: 'expense', cat: 'Transporte', method: '💳 Crédito', aiApplied: false, date: '09/05' },
  ];

  const AI_MSGS = ['Lendo o extrato...', 'Identificando transações...', 'Aplicando Notas para IA...', 'Categorizando regras...', 'Finalizando...'];

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function setProgress(cid, pct) {
    const fill = document.getElementById(`${cid}-vfill`);
    if (!fill) return;
    fill.style.width = Math.min(pct, 100) + '%';
    if (pct > 5) fill.classList.add('active');
  }

  function moveCursor(cursor, scene, el) {
    if (!cursor || !scene || !el) return;
    const sr = scene.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    cursor.style.left = ((er.left + er.width / 2 - sr.left) / sr.width * 100) + '%';
    cursor.style.top = ((er.top + er.height / 2 - sr.top) / sr.height * 100) + '%';
  }

  async function clickAt(cursor, scene, el) {
    moveCursor(cursor, scene, el);
    await delay(480);
    cursor.classList.add('clicking');
    await delay(280);
    cursor.classList.remove('clicking');
    await delay(100);
  }

  async function typeText(el, text, speed = 45) {
    el.textContent = '';
    for (const ch of text) {
      el.textContent += ch;
      await delay(speed + Math.random() * 15);
    }
  }

  function txHTML(tx) {
    const aiLabel = tx.aiApplied
      ? `<span class="demo-ai-badge"><i class="bi bi-cpu" style="font-size:8px;"></i> Regra IA</span>`
      : '';
    return `
      <div class="demo-tx-item" data-tx>
        <div class="demo-tx-icon">${tx.icon}</div>
        <div class="demo-tx-body">
          <div class="demo-tx-title">${tx.title}</div>
          <div class="demo-tx-meta">
            <span class="demo-tag demo-tag-cat">${tx.cat}</span>
            ${tx.sub ? `<span class="demo-tag demo-tag-method">${tx.sub}</span>` : ''}
            <span class="demo-tag demo-tag-method">${tx.method}</span>
            <span class="demo-tag demo-tag-date">${tx.date}</span>
            ${aiLabel}
          </div>
        </div>
        <div class="demo-tx-amount ${tx.type}">${tx.amount}</div>
      </div>`;
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
              <div class="demo-nav-item" id="${cid}-nav-txs"><i class="bi bi-arrow-left-right"></i> Transações</div>
              <div class="demo-nav-item active" id="${cid}-nav-cfg"><i class="bi bi-gear"></i> Configurações</div>
            </div>
          </div>
          <div class="demo-main">
            <!-- PHASE A: Settings Notes -->
            <div id="${cid}-ph-cfg" style="display:flex;flex-direction:column;flex:1;overflow:hidden;transition:opacity .25s;">
              <div class="demo-main-header">
                <div class="demo-hamburger"><i class="bi bi-list"></i></div>
                <i class="bi bi-gear" style="color:#a84551;font-size:13px"></i> Configurações
              </div>
              <div class="demo-content" style="overflow:hidden;">
                <div class="demo-settings-nav">
                  <div class="demo-settings-tab"><i class="bi bi-bank"></i> Contas</div>
                  <div class="demo-settings-tab"><i class="bi bi-tags"></i> Categorias</div>
                  <div class="demo-settings-tab active"><i class="bi bi-journal-text"></i> Notas IA</div>
                </div>
                <div class="demo-card">
                  <div style="font-size:11.5px;font-weight:700;margin-bottom:3px;display:flex;align-items:center;gap:5px;">
                    <i class="bi bi-journal-text" style="color:#a84551;"></i> Bloco de notas para IA
                  </div>
                  <div style="font-size:10px;color:#525252;margin-bottom:11px;line-height:1.5;">Regras e instruções incluídas no prompt da IA para classificar transações.</div>
                  <div class="demo-form-group">
                    <span class="demo-label">Título da nota</span>
                    <div class="demo-input" id="${cid}-note-title" style="min-height:28px;"></div>
                  </div>
                  <div class="demo-form-group">
                    <span class="demo-label">Descrição / Regra</span>
                    <div class="demo-input" id="${cid}-note-desc" style="min-height:52px;font-size:10.5px;line-height:1.5;word-break:break-word;"></div>
                  </div>
                  <div style="display:flex;gap:5px;margin-bottom:12px;">
                    <div class="demo-btn demo-btn-primary demo-btn-sm" id="${cid}-save-note">
                      <i class="bi bi-check-lg"></i> Salvar nota
                    </div>
                    <div class="demo-btn demo-btn-ghost demo-btn-sm"><i class="bi bi-x-lg"></i> Limpar</div>
                  </div>
                  <div id="${cid}-note-hint" style="font-size:10px;color:#525252;">Nenhuma nota adicionada ainda.</div>
                  <div id="${cid}-note-list"></div>
                </div>
              </div>
            </div>

            <!-- PHASE B: Transactions -->
            <div id="${cid}-ph-txs" style="display:none;flex-direction:column;flex:1;overflow:hidden;opacity:0;transition:opacity .25s;">
              <div class="demo-main-header">
                <div class="demo-hamburger"><i class="bi bi-list"></i></div>
                <i class="bi bi-arrow-left-right" style="color:#a84551;font-size:13px"></i> Transações
                <span style="margin-left:auto;">
                  <div class="demo-btn demo-btn-primary demo-btn-sm" id="${cid}-import-btn">
                    <i class="bi bi-robot"></i> Importar (IA)
                  </div>
                </span>
              </div>
              <div class="demo-content" style="position:relative;overflow:hidden;">
                <div id="${cid}-empty" style="display:flex;height:100%;align-items:center;justify-content:center;">
                  <div class="demo-empty">
                    <i class="bi bi-cash-stack"></i>
                    <p>Nenhuma transação<br><span style="font-size:10px;display:block;margin-top:2px;">Importe com IA para começar.</span></p>
                  </div>
                </div>
                <div id="${cid}-tx-list" style="display:none;padding-top:4px;"></div>
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
                <div class="demo-upload-sub">PDF, TXT, CSV</div>
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
              <div style="display:flex;gap:6px;margin-top:9px;" id="${cid}-modal-btns">
                <div class="demo-btn demo-btn-primary" id="${cid}-proc-btn"><i class="bi bi-robot"></i> Processar com IA</div>
                <div class="demo-btn demo-btn-ghost">Cancelar</div>
              </div>
            </div>
          </div>
        </div>

        <div class="demo-toast success" id="${cid}-toast-note">
          <span class="demo-toast-icon"><i class="bi bi-check-circle-fill"></i></span>
          <span>Nota adicionada!</span>
        </div>
        <div class="demo-toast success" id="${cid}-toast-import" style="bottom:32px;">
          <span class="demo-toast-icon"><i class="bi bi-cpu-fill"></i></span>
          <span>✨ 5 transações importadas!</span>
        </div>

        <div class="demo-cursor-el" id="${cid}-cursor">
          <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
            <path d="M4 1L4 21L8.5 16.5L12 24L14.5 23L11 15.5L18 15.5L4 1Z" fill="white" stroke="#1a1a1a" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <div class="demo-cursor-ripple"></div>
        </div>
        <div class="demo-video-bar">
          <div class="demo-video-track"><div class="demo-video-fill" id="${cid}-vfill"></div></div>
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
    $(`${cid}-ph-cfg`).style.display = 'flex';
    $(`${cid}-ph-cfg`).style.opacity = '1';
    $(`${cid}-ph-txs`).style.display = 'none';
    $(`${cid}-ph-txs`).style.opacity = '0';
    $(`${cid}-note-title`).textContent = '';
    $(`${cid}-note-desc`).textContent = '';
    $(`${cid}-note-list`).innerHTML = '';
    $(`${cid}-note-hint`).style.display = 'block';
    $(`${cid}-modal`).classList.remove('open');
    $(`${cid}-file-chip`).classList.remove('visible');
    $(`${cid}-ai-load`).style.display = 'none';
    $(`${cid}-modal-btns`).style.display = 'flex';
    $(`${cid}-ai-prog`).style.width = '0%';
    $(`${cid}-upload-zone`).classList.remove('drag-active');
    $(`${cid}-empty`).style.display = 'flex';
    $(`${cid}-tx-list`).style.display = 'none';
    $(`${cid}-tx-list`).innerHTML = '';
    $(`${cid}-toast-note`).classList.remove('visible');
    $(`${cid}-toast-import`).classList.remove('visible');
    $(`${cid}-nav-cfg`).classList.add('active');
    $(`${cid}-nav-txs`).classList.remove('active');
    setProgress(cid, 0);
    cursor.classList.remove('visible', 'clicking');

    await delay(500);

    // ── PHASE A: Write note ──
    const titleEl = $(`${cid}-note-title`);
    moveCursor(cursor, scene, titleEl);
    cursor.classList.add('visible');
    setProgress(cid, 5);
    await delay(600);

    // Click + type title
    cursor.classList.add('clicking');
    await delay(230);
    cursor.classList.remove('clicking');
    titleEl.classList.add('focused');
    setProgress(cid, 8);
    await delay(280);
    await typeText(titleEl, NOTE_TITLE, 55);
    titleEl.classList.remove('focused');
    setProgress(cid, 20);
    await delay(350);

    // Type description
    const descEl = $(`${cid}-note-desc`);
    descEl.classList.add('focused');
    moveCursor(cursor, scene, descEl);
    await delay(350);
    cursor.classList.add('clicking');
    await delay(220);
    cursor.classList.remove('clicking');
    await typeText(descEl, NOTE_DESC, 28);
    descEl.classList.remove('focused');
    setProgress(cid, 38);
    await delay(400);

    // Click save note
    const saveNote = $(`${cid}-save-note`);
    await clickAt(cursor, scene, saveNote);
    setProgress(cid, 44);

    // Clear form
    titleEl.textContent = '';
    descEl.textContent = '';

    // Note card appears
    $(`${cid}-note-hint`).style.display = 'none';
    $(`${cid}-note-list`).innerHTML = `
      <div class="demo-note-card" id="${cid}-note-card">
        <div class="demo-note-title">${NOTE_TITLE}</div>
        <div class="demo-note-desc">${NOTE_DESC}</div>
      </div>
    `;
    await delay(60);
    $(`${cid}-note-card`).classList.add('visible');
    setProgress(cid, 48);

    // Toast note
    await delay(150);
    $(`${cid}-toast-note`).classList.add('visible');
    await delay(1400);
    $(`${cid}-toast-note`).classList.remove('visible');
    setProgress(cid, 52);
    await delay(400);

    // ── Navigate to Transactions ──
    const navTxs = $(`${cid}-nav-txs`);
    await clickAt(cursor, scene, navTxs);

    $(`${cid}-nav-cfg`).classList.remove('active');
    $(`${cid}-nav-txs`).classList.add('active');

    $(`${cid}-ph-cfg`).style.opacity = '0';
    await delay(250);
    $(`${cid}-ph-cfg`).style.display = 'none';
    $(`${cid}-ph-txs`).style.display = 'flex';
    requestAnimationFrame(() => { $(`${cid}-ph-txs`).style.opacity = '1'; });
    setProgress(cid, 55);
    await delay(500);

    // ── PHASE B: Import ──
    const importBtn = $(`${cid}-import-btn`);
    await clickAt(cursor, scene, importBtn);
    $(`${cid}-modal`).classList.add('open');
    setProgress(cid, 60);
    await delay(550);

    // Drag file
    const uploadZone = $(`${cid}-upload-zone`);
    moveCursor(cursor, scene, uploadZone);
    await delay(450);
    uploadZone.classList.add('drag-active');
    setProgress(cid, 64);
    await delay(500);
    cursor.classList.add('clicking');
    await delay(250);
    cursor.classList.remove('clicking');
    uploadZone.classList.remove('drag-active');
    $(`${cid}-file-chip`).classList.add('visible');
    setProgress(cid, 68);
    await delay(550);

    // Click process
    const procBtn = $(`${cid}-proc-btn`);
    await clickAt(cursor, scene, procBtn);
    $(`${cid}-modal-btns`).style.display = 'none';
    $(`${cid}-ai-load`).style.display = 'block';
    setProgress(cid, 72);

    // AI progress
    const aiProg = $(`${cid}-ai-prog`);
    const aiMsg = $(`${cid}-ai-msg`);
    for (let i = 0; i <= 100; i += 2) {
      aiProg.style.width = i + '%';
      const mi = Math.floor((i / 100) * AI_MSGS.length);
      aiMsg.textContent = AI_MSGS[Math.min(mi, AI_MSGS.length - 1)];
      setProgress(cid, 72 + (i / 100) * 17);
      await delay(42);
    }
    setProgress(cid, 90);
    await delay(250);

    // Close modal
    $(`${cid}-modal`).classList.remove('open');
    await delay(180);
    $(`${cid}-empty`).style.display = 'none';
    $(`${cid}-tx-list`).style.display = 'block';

    // Transactions appear
    const list = $(`${cid}-tx-list`);
    list.innerHTML = '';
    for (let i = 0; i < TRANSACTIONS.length; i++) {
      const tx = TRANSACTIONS[i];
      list.insertAdjacentHTML('beforeend', txHTML(tx));
      const items = list.querySelectorAll('[data-tx]');
      const latest = items[items.length - 1];
      latest.classList.add('processing');
      await delay(80);
      latest.classList.remove('processing');
      latest.classList.add('visible');
      setProgress(cid, 90 + ((i + 1) / TRANSACTIONS.length) * 7);
      await delay(190);
    }

    // Import toast
    setProgress(cid, 97);
    $(`${cid}-toast-import`).classList.add('visible');
    cursor.classList.remove('visible');
    await delay(2400);
    $(`${cid}-toast-import`).classList.remove('visible');

    setProgress(cid, 100);
    await delay(1800);
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
