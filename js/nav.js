// ════════════════════════════════════════════════════════════
// nav.js — Navegación por pantallas (inicio / OTs / procedimientos)
// ════════════════════════════════════════════════════════════

// Pantalla actual: 'home' | 'otlist' | 'procmenu' | (vista de OT o sección)
let currentScreen = 'home';

// Muestra u oculta el botón "Inicio" según la pantalla
function updateHomeButton() {
  const btn = document.getElementById('btn-home');
  if(btn) btn.style.display = (currentScreen === 'home') ? 'none' : 'inline-flex';
  // Ocultar el banner de vencimientos WPQ si no estamos en la vista WPQ
  if(currentScreen !== 'wpq') {
    const slot = document.getElementById('wpq-banner-slot');
    if(slot){ slot.style.display = 'none'; slot.innerHTML = ''; }
  }
}

// ════════════════════════════════════════════════════════════
// Persistencia de navegación: al recargar (manual o automático)
// la app vuelve a la pantalla donde estabas, no a Inicio.
// ════════════════════════════════════════════════════════════
let _navRestoring = false;   // mientras restauramos, no guardamos estado intermedio

function getNavState() {
  return {
    screen: currentScreen,
    otId:        (typeof currentOT        !== 'undefined') ? currentOT        : null,
    tab:         (typeof currentTab       !== 'undefined') ? currentTab       : null,
    procSection: (typeof currentProcSection !== 'undefined') ? currentProcSection : null,
    wpq: (typeof wpqNav !== 'undefined' && wpqNav)
           ? { level: wpqNav.level, pst: wpqNav.pst, soldador: wpqNav.soldador }
           : null
  };
}

function saveNavState() {
  if(_navRestoring) return;
  try { localStorage.setItem('cimomet_nav', JSON.stringify(getNavState())); } catch(e){}
}

// Vuelve a dibujar la pantalla actual sin moverte de lugar.
// La usan tanto el refresco automático (polling) como el post-sync inicial.
function rerenderCurrentScreen() {
  switch(currentScreen) {
    case 'home':     showHome(); break;
    case 'otlist':   renderOTListScreen(); break;
    case 'procmenu': showProceduresMenu(); break;
    case 'procview': if(typeof showProceduresView==='function') showProceduresView(); break;
    case 'wpq':      if(typeof renderWPQ==='function') renderWPQ(); break;
    case 'ot':
      if((typeof currentOT!=='undefined') && currentOT && (db.ots||[]).find(x=>x.id===currentOT)) renderOT();
      else showOTList();
      break;
    default: showHome();
  }
}

// Restaura la última pantalla guardada (llamado al arrancar).
function restoreNavState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem('cimomet_nav') || 'null'); } catch(e){}
  if(!s || !s.screen) { showHome(); return; }

  _navRestoring = true;
  try {
    if(s.screen === 'otlist')        showOTList();
    else if(s.screen === 'procmenu') showProceduresMenu();
    else if(s.screen === 'procview') {
      if(s.procSection && typeof currentProcSection!=='undefined') currentProcSection = s.procSection;
      if(typeof showProceduresView==='function') showProceduresView();
    }
    else if(s.screen === 'wpq' && typeof showWPQView==='function') {
      showWPQView();                       // setea screen='wpq' y wpqNav al nivel PST
      if(s.wpq && s.wpq.pst) {
        if(s.wpq.level === 'archivos' && (db.wpq||[]).find(e=>e.id===s.wpq.soldador)) {
          wpqNav = { level:'archivos', pst:s.wpq.pst, soldador:s.wpq.soldador };
        } else {
          wpqNav = { level:'soldadores', pst:s.wpq.pst, soldador:null };
        }
        renderWPQ();
      }
    }
    else if(s.screen === 'ot') {
      const o = (db.ots||[]).find(x => x.id === s.otId);
      if(o) { currentOT = s.otId; currentTab = s.tab || 'datos'; currentScreen = 'ot'; renderOT(); }
      else showOTList();                   // la OT ya no existe → lista
    }
    else showHome();
  } catch(e) {
    console.error('[nav] restore falló:', e);
    showHome();
  }
  _navRestoring = false;
}

// ── Pantalla de inicio ───────────────────────────────────────
function showHome() {
  currentScreen = 'home';
  currentOT = null;
  updateHomeButton();
  const titleEl = document.getElementById('topbar-title');
  const actionsEl = document.getElementById('topbar-actions');
  if(titleEl) titleEl.textContent = 'CIMOMET SA';
  if(actionsEl) actionsEl.innerHTML = '';

  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="fade-in" style="max-width:760px;margin:40px auto 0">
      <div style="text-align:center;margin-bottom:32px">
        <div style="font-size:26px;font-weight:600;letter-spacing:-.01em">CIMOMET S.A.</div>
        <div style="font-size:14px;color:var(--text2);margin-top:4px">Gestión de Databooks de Calidad</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
        <div class="home-card" onclick="showOTList()">
          <svg width="46" height="46" viewBox="0 0 24 24" fill="var(--accent)"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
          <div class="home-card-title">Órdenes de Trabajo</div>
          <div class="home-card-sub">Databooks por OT</div>
        </div>
        <div class="home-card" onclick="showProceduresMenu()">
          <svg width="46" height="46" viewBox="0 0 24 24" fill="var(--accent)"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
          <div class="home-card-title">Procedimientos</div>
          <div class="home-card-sub">END · Tratamiento · WPS · WPQ</div>
        </div>
      </div>
    </div>`;
  saveNavState();
}

// ── Pantalla: lista de OTs (formato tarjetas) ───────────────
function showOTList() {
  currentScreen = 'otlist';
  currentOT = null;
  updateHomeButton();
  const titleEl = document.getElementById('topbar-title');
  const actionsEl = document.getElementById('topbar-actions');
  if(titleEl) titleEl.textContent = 'Órdenes de Trabajo';
  if(actionsEl) actionsEl.innerHTML =
    `<button class="btn btn-primary btn-sm" onclick="openNewOTModal()">+ Nueva OT</button>`;

  renderOTListScreen();
}

function renderOTListScreen() {
  const main = document.getElementById('main-content');
  if(!db.ots.length){
    main.innerHTML = `<div class="empty fade-in">
      <div class="empty-icon">📋</div>
      <h3>Sin órdenes de trabajo</h3>
      <p>Creá tu primera OT para empezar.</p><br>
      <button class="btn btn-primary" onclick="openNewOTModal()">+ Nueva OT</button>
    </div>`;
    return;
  }

  const STATUS_GROUPS = [
    { key: 'active',  label: 'En proceso' },
    { key: 'pending', label: 'Pendiente'  },
    { key: 'done',    label: 'Terminada'  },
  ];
  const grouped = {};
  STATUS_GROUPS.forEach(g => grouped[g.key] = []);
  db.ots.forEach(ot => { (grouped[ot.estado||'active'] = grouped[ot.estado||'active']||[]).push(ot); });

  const card = (ot) => `
    <div class="ot-card" onclick="selectOT('${ot.id}')">
      <div class="ot-card-head">
        <div class="ot-card-num">OT ${esc(ot.num)}</div>
        <span class="badge ${STATUS_BADGE[ot.estado||'active']}">${STATUS_LABELS[ot.estado||'active']}</span>
      </div>
      <div class="ot-card-obra">${esc(ot.obra || 'Sin descripción de obra')}</div>
      <div class="ot-card-cliente">${esc(ot.cliente || 'Sin cliente')}</div>
      ${ot.plano ? `<div class="ot-card-foot">Plano: ${esc(ot.plano)}${ot.anio?(' · '+esc(ot.anio)):''}</div>` : (ot.anio?`<div class="ot-card-foot">${esc(ot.anio)}</div>`:'')}
    </div>`;

  const sections = STATUS_GROUPS.map(g => {
    const ots = grouped[g.key];
    if(!ots.length) return '';
    return `<div style="margin-bottom:24px">
      <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);margin-bottom:10px;display:flex;align-items:center;gap:8px">
        ${g.label} <span style="background:var(--surface2);border-radius:10px;padding:1px 8px;font-size:11px">${ots.length}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
        ${ots.map(card).join('')}
      </div>
    </div>`;
  }).join('');

  main.innerHTML = `<div class="fade-in">${sections}</div>`;
  saveNavState();
}

// ── Pantalla: menú de procedimientos ─────────────────────────
function showProceduresMenu() {
  currentScreen = 'procmenu';
  currentOT = null;
  updateHomeButton();
  const titleEl = document.getElementById('topbar-title');
  const actionsEl = document.getElementById('topbar-actions');
  if(titleEl) titleEl.textContent = 'Procedimientos';
  if(actionsEl) actionsEl.innerHTML = '';

  const counts = { end:0, sup:0, wps:0 };
  (db.procedures||[]).forEach(p => {
    const cat = (typeof procCategory==='function') ? procCategory(p.type) : '';
    if(cat === 'Procedimiento de Soldadura (WPS/PQR)') counts.wps++;
    else if(cat === 'Procedimiento de Pintura / Tratamiento Superficial') counts.sup++;
    else counts.end++;
  });
  const wpqCount = (db.wpq||[]).length;

  const main = document.getElementById('main-content');
  const menuCard = (onclick, icon, title, sub) => `
    <div class="home-card" style="padding:22px 18px" onclick="${onclick}">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="var(--accent)">${icon}</svg>
      <div class="home-card-title" style="font-size:15px">${title}</div>
      <div class="home-card-sub">${sub}</div>
    </div>`;

  main.innerHTML = `<div class="fade-in" style="max-width:760px;margin:20px auto 0">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      ${menuCard("showProceduresView('END')", '<path d="M19.8 18.4L14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4c-.49.66-.02 1.6.8 1.6h14c.82 0 1.29-.94.8-1.6z"/>', 'END', counts.end + ' procedimientos')}
      ${menuCard("showProceduresView('Tratamiento Superficial')", '<path d="M18 4V3c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6h1v4H9v11c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-9h8V4h-3z"/>', 'Tratamiento Superficial', counts.sup + ' procedimientos')}
      ${menuCard("showProceduresView('WPS y PQR')", '<path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>', 'WPS y PQR', counts.wps + ' procedimientos')}
      ${menuCard("showWPQView()", '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>', 'WPQ', 'Calificación de soldadores')}
    </div>
  </div>`;
  saveNavState();
}

// Compat: algunas funciones viejas llaman renderSidebar(); lo redirigimos
function renderSidebar() {
  if(currentScreen === 'otlist') renderOTListScreen();
  else if(currentScreen === 'home') { /* nada */ }
}
