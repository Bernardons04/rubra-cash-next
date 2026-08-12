/**
 * categoriesFlow.js v2 — Custom Categories
 * cursor + progress bar + auto-loop + no-scroll
 */
window.CategoriesFlow = (function () {

  const EXISTING = [
    { name: 'Barbearia', subs: ['Corte', 'Barba', 'Sobrancelha'] },
    { name: 'Pets', subs: ['Ração', 'Veterinário'] },
  ];

  const NEW_CAT = { name: 'Academia & Fitness', subcats: ['Mensalidade', 'Personal', 'Suplementos'] };

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

  function existingCatHTML(cat) {
    return `<div class="demo-cat-card visible">
      <div class="demo-cat-header">
        <div class="demo-cat-name">${cat.name}</div>
        <div style="display:flex;gap:4px;">
          <div class="demo-btn demo-btn-ghost demo-btn-sm"><i class="bi bi-pencil"></i></div>
          <div class="demo-btn demo-btn-ghost demo-btn-sm" style="color:#ff4d6d;border-color:#ff4d6d30;background:#ff4d6d18;"><i class="bi bi-trash"></i></div>
        </div>
      </div>
      <div class="demo-cat-subcats">${cat.subs.map(s => `<span class="demo-subcat-badge">${s}</span>`).join('')}</div>
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
              <div class="demo-nav-item"><i class="bi bi-arrow-left-right"></i> Transações</div>
              <div class="demo-nav-item active"><i class="bi bi-gear"></i> Configurações</div>
            </div>
          </div>
          <div class="demo-main">
            <div class="demo-main-header">
              <div class="demo-hamburger"><i class="bi bi-list"></i></div>
              <i class="bi bi-gear" style="color:#a84551;font-size:13px"></i> Configurações
            </div>
            <div class="demo-content" style="overflow:hidden;">
              <div class="demo-settings-nav">
                <div class="demo-settings-tab"><i class="bi bi-bank"></i> Contas</div>
                <div class="demo-settings-tab active"><i class="bi bi-tags"></i> Categorias</div>
                <div class="demo-settings-tab"><i class="bi bi-journal-text"></i> Notas IA</div>
              </div>
              <div class="demo-card">
                <div style="font-size:11.5px;font-weight:700;margin-bottom:3px;display:flex;align-items:center;gap:5px;">
                  <i class="bi bi-tags" style="color:#a84551;"></i> Categorias Personalizadas
                </div>
                <div style="font-size:10px;color:#525252;margin-bottom:11px;">Crie categorias para o seu estilo de vida.</div>

                <div class="demo-form-group">
                  <span class="demo-label">Nome da categoria</span>
                  <div class="demo-input" id="${cid}-cat-name" style="min-height:28px;"></div>
                </div>
                <div class="demo-form-group">
                  <span class="demo-label">Subcategorias</span>
                  <div style="display:flex;gap:5px;margin-bottom:6px;">
                    <div class="demo-input" id="${cid}-subcat-input" style="flex:1;min-height:28px;"></div>
                    <div class="demo-btn demo-btn-ghost demo-btn-sm" id="${cid}-add-sub-btn"><i class="bi bi-plus-lg"></i></div>
                  </div>
                  <div id="${cid}-badges" style="display:flex;flex-wrap:wrap;gap:4px;min-height:14px;"></div>
                </div>
                <div style="display:flex;gap:5px;margin-bottom:12px;">
                  <div class="demo-btn demo-btn-primary demo-btn-sm" id="${cid}-save-btn">
                    <i class="bi bi-check-lg"></i> Salvar categoria
                  </div>
                  <div class="demo-btn demo-btn-ghost demo-btn-sm"><i class="bi bi-x-lg"></i> Limpar</div>
                </div>
                <div id="${cid}-cat-list">${EXISTING.map(existingCatHTML).join('')}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="demo-toast success" id="${cid}-toast">
          <span class="demo-toast-icon"><i class="bi bi-check-circle-fill"></i></span>
          <span>Categoria salva!</span>
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
    $(`${cid}-cat-name`).textContent = '';
    $(`${cid}-subcat-input`).textContent = '';
    $(`${cid}-badges`).innerHTML = '';
    $(`${cid}-toast`).classList.remove('visible');
    const prev = $(`${cid}-new-cat`);
    if (prev) prev.remove();
    setProgress(cid, 0);
    cursor.classList.remove('visible', 'clicking');

    await delay(500);

    // Show cursor at name field
    const nameEl = $(`${cid}-cat-name`);
    moveCursor(cursor, scene, nameEl);
    cursor.classList.add('visible');
    setProgress(cid, 8);
    await delay(600);

    // Step 1: Click name field + type
    cursor.classList.add('clicking');
    await delay(250);
    cursor.classList.remove('clicking');
    nameEl.classList.add('focused');
    setProgress(cid, 12);
    await delay(300);
    await typeText(nameEl, NEW_CAT.name, 55);
    nameEl.classList.remove('focused');
    setProgress(cid, 30);
    await delay(400);

    // Step 2: Add subcategories
    const subcatInput = $(`${cid}-subcat-input`);
    const badgesEl = $(`${cid}-badges`);
    const addBtn = $(`${cid}-add-sub-btn`);

    for (let i = 0; i < NEW_CAT.subcats.length; i++) {
      const sub = NEW_CAT.subcats[i];
      moveCursor(cursor, scene, subcatInput);
      await delay(400);
      cursor.classList.add('clicking');
      await delay(200);
      cursor.classList.remove('clicking');
      subcatInput.classList.add('focused');
      await typeText(subcatInput, sub, 60);
      setProgress(cid, 32 + i * 12);
      await delay(250);

      // Click add button
      await clickAt(cursor, scene, addBtn);
      subcatInput.classList.remove('focused');

      // Badge appears
      const badge = document.createElement('span');
      badge.style.cssText = 'background:#a84551;color:#fff;padding:2px 8px;border-radius:100px;font-size:9.5px;font-weight:600;display:inline-flex;align-items:center;gap:4px;opacity:0;transition:opacity .22s;';
      badge.innerHTML = `${sub} <span style="cursor:default;font-size:11px;line-height:1;">×</span>`;
      badgesEl.appendChild(badge);
      await delay(40);
      badge.style.opacity = '1';
      subcatInput.textContent = '';
      await delay(350);
    }
    setProgress(cid, 65);
    await delay(400);

    // Step 3: Click save
    const saveBtn = $(`${cid}-save-btn`);
    await clickAt(cursor, scene, saveBtn);
    setProgress(cid, 75);

    // Clear form
    nameEl.textContent = '';
    badgesEl.innerHTML = '';

    // Step 4: Category card appears
    const catList = $(`${cid}-cat-list`);
    const subsHTML = NEW_CAT.subcats.map(s => `<span class="demo-subcat-badge">${s}</span>`).join('');
    catList.insertAdjacentHTML('afterbegin', `
      <div class="demo-cat-card" id="${cid}-new-cat">
        <div class="demo-cat-header">
          <div class="demo-cat-name">${NEW_CAT.name}</div>
          <div style="display:flex;gap:4px;">
            <div class="demo-btn demo-btn-ghost demo-btn-sm"><i class="bi bi-pencil"></i></div>
            <div class="demo-btn demo-btn-ghost demo-btn-sm" style="color:#ff4d6d;border-color:#ff4d6d30;background:#ff4d6d18;"><i class="bi bi-trash"></i></div>
          </div>
        </div>
        <div class="demo-cat-subcats">${subsHTML}</div>
      </div>
    `);
    await delay(60);
    $(`${cid}-new-cat`).classList.add('visible');
    setProgress(cid, 88);

    // Toast
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
