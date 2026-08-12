/**
 * accountsFlow.js v2 — Accounts Management
 * cursor + progress bar + auto-loop + no-scroll
 */
window.AccountsFlow = (function () {

  const EXISTING = [
    { dot: '#75d934', emoji: '🏦', name: 'Apex Bank', balance: 'R$ 3.210,50' },
    { dot: '#f59e0b', emoji: '💳', name: 'Nova Finance', balance: 'R$ 1.840,00' },
  ];

  const NEW_ACC = { dot: '#4d9fff', emoji: '📱', name: 'Zenith Digital', balance: 'R$ 0,00', anchor: '08/05/2025', anchorBal: '0,00', color: '#4d9fff' };

  const COLORS = ['#4d9fff', '#00e5b0', '#f5a623', '#ff4d6d', '#a855f7', '#75d934', '#f472b6', '#fb923c'];

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
    await delay(500);
    cursor.classList.add('clicking');
    await delay(280);
    cursor.classList.remove('clicking');
    await delay(100);
  }

  async function typeText(el, text, speed = 60) {
    el.textContent = '';
    for (const ch of text) {
      el.textContent += ch;
      await delay(speed + Math.random() * 20);
    }
  }

  function existingHTML(acc) {
    return `<div class="demo-acc-item visible">
      <div class="demo-acc-left">
        <div class="demo-acc-dot" style="background:${acc.dot}"></div>
        <div class="demo-acc-emoji">${acc.emoji}</div>
        <div>
          <div class="demo-acc-name">${acc.name}</div>
          <div class="demo-acc-balance">${acc.balance}</div>
        </div>
      </div>
      <div style="display:flex;gap:4px;">
        <div class="demo-btn demo-btn-ghost demo-btn-sm"><i class="bi bi-pencil"></i></div>
        <div class="demo-btn demo-btn-ghost demo-btn-sm" style="color:#ff4d6d;border-color:#ff4d6d30;background:#ff4d6d18;"><i class="bi bi-trash"></i></div>
      </div>
    </div>`;
  }

  function buildHTML(cid) {
    const colorDots = COLORS.map((c, i) =>
      `<div class="demo-color-swatch ${i === 0 ? 'selected' : ''}" id="${cid}-color-${i}" style="background:${c}"></div>`
    ).join('');

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
              <div class="demo-nav-item"><i class="bi bi-arrow-left-right"></i> Transações</div>
              <div class="demo-nav-item active"><i class="bi bi-gear"></i> Configurações</div>
            </div>
          </div>
          <div class="demo-main">
            <div class="demo-main-header">
              <div class="demo-hamburger"><i class="bi bi-list"></i></div>
              <div style="display:flex;align-items:center;gap:6px;">
                <i class="bi bi-gear" style="color:#a84551;font-size:13px"></i> Configurações
              </div>
            </div>
            <div class="demo-content" style="overflow:hidden;">
              <div class="demo-settings-nav">
                <div class="demo-settings-tab active"><i class="bi bi-bank"></i> Contas</div>
                <div class="demo-settings-tab"><i class="bi bi-tags"></i> Categorias</div>
                <div class="demo-settings-tab"><i class="bi bi-journal-text"></i> Notas IA</div>
              </div>
              <div class="demo-card">
                <div style="font-size:11.5px;font-weight:700;margin-bottom:3px;display:flex;align-items:center;gap:5px;">
                  <i class="bi bi-bank" style="color:#a84551;"></i> Contas
                  <span style="background:rgba(168,69,81,.12);color:#a84551;border:1px solid rgba(168,69,81,.25);font-size:8.5px;padding:1px 6px;border-radius:100px;font-weight:700;">Opcional</span>
                </div>
                <div style="font-size:10px;color:#525252;margin-bottom:11px;line-height:1.5;">Cadastre suas contas para rastrear saldos reais.</div>
                <div id="${cid}-acc-list">${EXISTING.map(existingHTML).join('')}</div>
                <div class="demo-btn demo-btn-primary demo-btn-sm" id="${cid}-new-btn" style="margin-top:9px;">
                  <i class="bi bi-plus-lg"></i> Nova Conta
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal -->
        <div class="demo-modal-overlay" id="${cid}-modal">
          <div class="demo-modal">
            <div class="demo-modal-header">
              <div class="demo-modal-title">Nova Conta</div>
              <div class="demo-modal-close">✕</div>
            </div>
            <div class="demo-modal-body">
              <div class="demo-form-group">
                <span class="demo-label">Nome da conta</span>
                <div class="demo-input" id="${cid}-name" style="min-height:28px;"></div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">
                <div class="demo-form-group">
                  <span class="demo-label">Cor</span>
                  <div class="demo-color-row" id="${cid}-colors">${colorDots}</div>
                </div>
                <div class="demo-form-group">
                  <span class="demo-label">Emoji</span>
                  <div class="demo-input" id="${cid}-emoji" style="font-size:15px;text-align:center;padding:5px;">🏦</div>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">
                <div class="demo-form-group">
                  <span class="demo-label">Data âncora</span>
                  <div class="demo-input" id="${cid}-date" style="min-height:28px;font-size:11px;"></div>
                </div>
                <div class="demo-form-group">
                  <span class="demo-label">Saldo âncora</span>
                  <div class="demo-input" id="${cid}-bal" style="min-height:28px;"></div>
                </div>
              </div>
              <div style="display:flex;gap:6px;margin-top:2px;">
                <div class="demo-btn demo-btn-primary" id="${cid}-save" style="flex:1;justify-content:center;">
                  <i class="bi bi-check-lg"></i> Salvar Conta
                </div>
                <div class="demo-btn demo-btn-ghost">Cancelar</div>
              </div>
            </div>
          </div>
        </div>

        <div class="demo-toast success" id="${cid}-toast">
          <span class="demo-toast-icon"><i class="bi bi-check-circle-fill"></i></span>
          <span>Conta criada!</span>
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

    // Reset
    $(`${cid}-modal`).classList.remove('open');
    $(`${cid}-toast`).classList.remove('visible');
    $(`${cid}-name`).textContent = '';
    $(`${cid}-date`).textContent = '';
    $(`${cid}-bal`).textContent = '';
    $(`${cid}-emoji`).textContent = '🏦';
    const prev = $(`${cid}-new-acc`);
    if (prev) prev.remove();
    setProgress(cid, 0);
    cursor.classList.remove('visible', 'clicking');

    // Reset color swatches
    $(`${cid}-colors`).querySelectorAll('.demo-color-swatch').forEach((s, i) => {
      s.classList.toggle('selected', i === 0);
    });

    await delay(500);

    // Show cursor at Nova Conta button
    const newBtn = $(`${cid}-new-btn`);
    moveCursor(cursor, scene, newBtn);
    cursor.classList.add('visible');
    setProgress(cid, 8);
    await delay(700);

    // Step 1: Click Nova Conta
    await clickAt(cursor, scene, newBtn);
    $(`${cid}-modal`).classList.add('open');
    setProgress(cid, 15);
    await delay(550);

    // Step 2: Type name
    const nameEl = $(`${cid}-name`);
    nameEl.classList.add('focused');
    moveCursor(cursor, scene, nameEl);
    await delay(400);
    await typeText(nameEl, NEW_ACC.name, 60);
    nameEl.classList.remove('focused');
    setProgress(cid, 30);
    await delay(350);

    // Step 3: Click first color swatch
    const swatch = $(`${cid}-color-0`);
    await clickAt(cursor, scene, swatch);
    setProgress(cid, 38);

    // Step 4: Change emoji
    const emojiEl = $(`${cid}-emoji`);
    moveCursor(cursor, scene, emojiEl);
    await delay(400);
    cursor.classList.add('clicking');
    await delay(250);
    cursor.classList.remove('clicking');
    emojiEl.style.transition = 'transform .2s';
    emojiEl.style.transform = 'scale(.8)';
    await delay(180);
    emojiEl.textContent = NEW_ACC.emoji;
    emojiEl.style.transform = '';
    setProgress(cid, 50);
    await delay(350);

    // Step 5: Fill date
    const dateEl = $(`${cid}-date`);
    dateEl.classList.add('focused');
    moveCursor(cursor, scene, dateEl);
    await delay(350);
    await typeText(dateEl, NEW_ACC.anchor, 65);
    dateEl.classList.remove('focused');
    setProgress(cid, 65);
    await delay(300);

    // Step 6: Fill balance
    const balEl = $(`${cid}-bal`);
    balEl.classList.add('focused');
    moveCursor(cursor, scene, balEl);
    await delay(350);
    await typeText(balEl, NEW_ACC.anchorBal, 75);
    balEl.classList.remove('focused');
    setProgress(cid, 75);
    await delay(400);

    // Step 7: Click save
    const saveBtn = $(`${cid}-save`);
    await clickAt(cursor, scene, saveBtn);
    $(`${cid}-modal`).classList.remove('open');
    setProgress(cid, 83);
    await delay(180);

    // Step 8: New account slides in
    const accList = $(`${cid}-acc-list`);
    accList.insertAdjacentHTML('beforeend', `
      <div class="demo-acc-item" id="${cid}-new-acc">
        <div class="demo-acc-left">
          <div class="demo-acc-dot" style="background:${NEW_ACC.dot}"></div>
          <div class="demo-acc-emoji">${NEW_ACC.emoji}</div>
          <div>
            <div class="demo-acc-name">${NEW_ACC.name}</div>
            <div class="demo-acc-balance">${NEW_ACC.balance}</div>
          </div>
        </div>
        <div style="display:flex;gap:4px;">
          <div class="demo-btn demo-btn-ghost demo-btn-sm"><i class="bi bi-pencil"></i></div>
          <div class="demo-btn demo-btn-ghost demo-btn-sm" style="color:#ff4d6d;border-color:#ff4d6d30;background:#ff4d6d18;"><i class="bi bi-trash"></i></div>
        </div>
      </div>
    `);
    await delay(60);
    $(`${cid}-new-acc`).classList.add('visible');
    setProgress(cid, 90);

    // Step 9: Toast
    await delay(180);
    $(`${cid}-toast`).classList.add('visible');
    cursor.classList.remove('visible');
    await delay(2000);
    $(`${cid}-toast`).classList.remove('visible');

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
