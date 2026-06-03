// ════════════════════════════════════════════════════════════
// procedimientos.js — Biblioteca de procedimientos y asignación
// ════════════════════════════════════════════════════════════

function procCategory(type) {
  for(const [cat, types] of Object.entries(PROC_CATEGORIES)) {
    if(types.includes(type)) return cat;
  }
  return 'Procedimientos de Ensayos'; // custom types default to ensayos
}


// Map procedure type → databook items to add when manually assigned
const PROC_TYPE_TO_ITEMS = {
  'Líquidos Penetrantes':                ['INFORMES DE LIQUIDOS PENETRANTES', 'PROCEDIMIENTOS DE END'],
  'Radiografía / Gammagrafía':           ['INFORME DE GAMMAGRAFIA', 'PROCEDIMIENTOS DE END'],
  'Ultrasonido':                         ['INFORME DE ULTRASONIDO', 'PROCEDIMIENTOS DE END'],
  'Visual de Soldaduras':                ['PROCEDIMIENTOS DE END'],
  'Dimensional':                         ['PROTOCOLO DE CONTROL DIMENSIONAL'],
  'Pintura':      ['PROCEDIMIENTO DE TRATAMIENTO SUPERFICIAL', 'INFORME DE TRATAMIENTO SUPERFICIAL'],
  'Galvanizado':  ['PROCEDIMIENTO DE TRATAMIENTO SUPERFICIAL', 'INFORME DE TRATAMIENTO SUPERFICIAL'],
  'Decapado y Pasivado': ['PROCEDIMIENTO DE TRATAMIENTO SUPERFICIAL', 'INFORME DE TRATAMIENTO SUPERFICIAL'],
  'Prueba Hidráulica':                   ['INFORME DE PRUEBA HIDRAULICA'],
  'Prueba Neumática':                    ['INFORME DE PRUEBA NEUMATICA'],
  'WPS / Soldadura':                     ['WPS Y PQR'],
  'Otro':                                []
};

const PROC_ITEM_MAP = {
  'Líquidos Penetrantes': ['LIQUIDOS PENETRANTE', 'LP'],
  'Radiografía / Gammagrafía': ['RADIOGRAFI', 'GAMMAGRAF'],
  'Ultrasonido': ['ULTRASONIDO'],
  'Visual de Soldaduras': ['VISUAL DE SOLDADURAS', 'CONTROL VISUAL'],
  'Dimensional': ['DIMENSIONAL', 'ISO 13920'],
  'Pintura':      ['PINTURA', 'TRATAMIENTO SUPERFICIAL'],
  'Galvanizado':  ['GALVANIZADO', 'GALVANIZ'],
  'Decapado y Pasivado': ['DECAPADO', 'PASIVADO'],
  'Prueba Hidráulica': ['PRUEBA HIDRAULICA', 'HIDRAUL'],
  'Prueba Neumática': ['PRUEBA NEUMATICA', 'NEUMAT'],
  'WPS / Soldadura': [],  // never auto-matched — assign manually per OT
  'Otro': []
};

// ── PST number matching for WPS/PQR procedures ───────────────────────────────

function wpsMatchesOT(proc, ot) {
  if(proc.type !== 'WPS / Soldadura') return false;
  const filePST = extractPSTFromFilename(proc.filename || proc.name);
  if(!filePST) return false;
  const f07text = ot.f07text || '';
  if(!f07text) return false;
  const f07PSTs = extractPSTsFromText(f07text);
  if(!f07PSTs.size) return false;
  const fileNorm = normPST(filePST);
  const matched = [...f07PSTs].some(p => normPST(p) === fileNorm);
  // Debug: log first time called
  if(!wpsMatchesOT._logged) {
    wpsMatchesOT._logged = true;
    console.log('[WPS] f07text snippet:', f07text.slice(0,200));
    console.log('[WPS] f07PSTs:', [...f07PSTs]);
    console.log('[WPS] sample proc:', proc.filename, '→ PST:', filePST, '→ norm:', fileNorm, '→ match:', matched);
  }
  return matched;
}

function procMatchesOT(proc, ot) {
  // Never match excluded procs
  if((ot.excludedProcs||[]).includes(proc.id)) return false;
  // WPS / Soldadura: match by PST number in filename vs F-07 text
  if(proc.type === 'WPS / Soldadura') return wpsMatchesOT(proc, ot);
  // Only auto-match when F-07 has been loaded (f07s.length > 0)
  const f07Loaded = ot.f07s && ot.f07s.length > 0;
  if(!f07Loaded && !(ot.customItems && ot.customItems.length)) return false;
  const allItems = [...(ot.items || (f07Loaded ? [] : ALL_ITEMS)), ...(ot.customItems||[])];
  const itemsText = allItems.join(' ').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  const keywords = PROC_ITEM_MAP[proc.type] || [];
  if(keywords.length === 0) return false; // "Otro" doesn't auto-match
  return keywords.some(kw => itemsText.includes(kw.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'')));
}

function updateProcsSidebarCount() {
  const procs = db.procedures || [];
  const counts = { 'END': 0, 'Tratamiento Superficial': 0, 'WPS y PQR': 0 };
  procs.forEach(p => {
    const cat = procCategory(p.type);
    const key = CAT_TO_SIDEBAR[cat];
    if(key && counts[key] !== undefined) counts[key]++;
  });
  const labels = {
    'END': 'sidebar-count-end',
    'Tratamiento Superficial': 'sidebar-count-sup',
    'WPS y PQR': 'sidebar-count-wps'
  };
  const descs = {
    'END': 'Ensayos no destructivos',
    'Tratamiento Superficial': 'Pintura y tratamientos',
    'WPS y PQR': 'Soldadura'
  };
  Object.entries(labels).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if(el) el.textContent = counts[key] > 0
      ? counts[key] + ' procedimiento' + (counts[key] !== 1 ? 's' : '')
      : descs[key];
  });
}

// Map sidebar keys to PROC_CATEGORIES keys
const SIDEBAR_TO_CAT = {
  'END': 'Procedimientos de Ensayos',
  'Tratamiento Superficial': 'Procedimiento de Pintura / Tratamiento Superficial',
  'WPS y PQR': 'Procedimiento de Soldadura (WPS/PQR)'
};
const CAT_TO_SIDEBAR = Object.fromEntries(Object.entries(SIDEBAR_TO_CAT).map(([k,v])=>[v,k]));
const SIDEBAR_IDS = { 'END':'sidebar-proc-end', 'Tratamiento Superficial':'sidebar-proc-sup', 'WPS y PQR':'sidebar-proc-wps' };

let currentProcSection = 'END'; // which submenu is active

function showProceduresView(section) {
  if(section) currentProcSection = section;
  currentOT = null;
  currentTab = 'datos';
  document.querySelectorAll('.ot-item').forEach(el => el.classList.remove('active'));
  const activeId = SIDEBAR_IDS[currentProcSection];
  if(activeId) document.getElementById(activeId)?.classList.add('active');
  updateProcsSidebarCount();
  const titles = {
    'END': 'Procedimientos de Ensayos No Destructivos',
    'Tratamiento Superficial': 'Procedimientos de Tratamiento Superficial',
    'WPS y PQR': 'Procedimientos de Soldadura — WPS y PQR'
  };
  document.getElementById('topbar-title').textContent = titles[currentProcSection] || 'Procedimientos';
  document.getElementById('topbar-actions').innerHTML =
    `<button class="btn btn-primary btn-sm" onclick="openAddProcModal()">+ Cargar procedimiento</button>`;
  renderProceduresLibrary();
}

function renderProceduresLibrary() {
  const el = document.getElementById('main-content');
  const allProcs = db.procedures || [];
  // Filter to current section
  const activeCat = SIDEBAR_TO_CAT[currentProcSection] || Object.values(SIDEBAR_TO_CAT)[0];
  const procs = allProcs.filter(p => procCategory(p.type) === activeCat);

  if(!procs.length) {
    el.innerHTML = `<div class="empty fade-in">
      <div class="empty-icon">📋</div>
      <h3>Sin procedimientos en esta sección</h3>
      <p>Cargá procedimientos para asociarlos automáticamente a las OTs.</p>
      <br><button class="btn btn-primary" onclick="openAddProcModal()">+ Cargar procedimiento</button>
    </div>`;
    return;
  }

  // Group by type within this section
  const byCategory = {};
  Object.keys(PROC_CATEGORIES).forEach(cat => { byCategory[cat] = {}; });
  procs.forEach(p => {
    const cat = procCategory(p.type);
    if(!byCategory[cat]) byCategory[cat] = {};
    if(!byCategory[cat][p.type]) byCategory[cat][p.type] = [];
    byCategory[cat][p.type].push(p);
  });

  const procCardHtml = (p) => `
    <div class="proc-card">
      <div class="proc-icon" style="font-size:18px">${p.fileType==='pdf'?'📕':'📘'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500">${esc(p.name)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:1px">${esc(p.type)} · ${p.date}</div>
      </div>
      <div style="display:flex;gap:5px;align-items:center">
        <button class="btn btn-secondary btn-sm" title="Imprimir" onclick="printProc('${p.id}')" style="padding:5px 8px">
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
        </button>
        <button class="btn btn-secondary btn-sm" title="Descargar" onclick="downloadProc('${p.id}')" style="padding:5px 8px">
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M5 20h14v-2H5v2zm7-18v10.59l-3.29-3.3-1.42 1.42L12 16l4.71-4.71-1.42-1.42L13 13.17V2h-1z"/></svg>
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteProc('${p.id}')" style="padding:5px 8px">✕</button>
      </div>
    </div>`;

  // Only show types that belong to the active section
  const activeTypeMap = byCategory[activeCat] || {};
  el.innerHTML = `<div class="fade-in">
    ${Object.keys(activeTypeMap).length === 0
      ? '<p style="font-size:13px;color:var(--text3)">Sin procedimientos en esta sección.</p>'
      : Object.entries(activeTypeMap).map(([type, list]) => `
        <div class="card" style="margin-bottom:10px">
          <div class="card-header" style="margin-bottom:8px">
            <span class="card-title">${type}</span>
            <span class="chip">${list.length} archivo${list.length>1?'s':''}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:7px">
            ${list.map(procCardHtml).join('')}
          </div>
        </div>`).join('')}
  </div>`;
}

function procIsManual(ot, procId) {
  return (ot.manualProcs||[]).includes(procId);
}

// Sort ot.items according to canonical order:
// standard items by ALL_ITEMS index; custom items (pruebas, etc.) slot in
// between "INFORME DE ULTRASONIDO" (pos 9) and "INFORME DE TRATAMIENTO SUPERFICIAL" (pos 10)

function unassignProc(procId) {
  const ot = db.ots.find(o => o.id === currentOT);
  if(!ot) return;
  const autoMatched = (db.procedures||[]).filter(p => procMatchesOT(p, ot));
  const isAuto = autoMatched.some(p => p.id === procId);
  if(isAuto) {
    // Add to excluded list so it won't auto-match anymore
    if(!ot.excludedProcs) ot.excludedProcs = [];
    if(!ot.excludedProcs.includes(procId)) ot.excludedProcs.push(procId);
  } else {
    // Remove from manual list via toggleManualProc
    toggleManualProc(procId);
    return;
  }
  // Remove associated databook items if no other proc of same type remains
  const proc = (db.procedures||[]).find(p => p.id === procId);
  if(proc) {
    const stillAssigned = (db.procedures||[]).some(p =>
      p.type === proc.type && p.id !== procId &&
      ((ot.manualProcs||[]).includes(p.id) || (procMatchesOT(p, ot) && !(ot.excludedProcs||[]).includes(p.id)))
    );
    if(!stillAssigned) {
      const itemsToRemove = PROC_TYPE_TO_ITEMS[proc.type] || [];
      itemsToRemove.forEach(item => {
        if((DEFAULT_ITEMS||[]).includes(item)) return;
        if(ot.items) {
          const i = ot.items.indexOf(item);
          if(i >= 0) ot.items.splice(i, 1);
        }
      });
    }
  }
  saveDB();
  renderTab();
}

function reassignProc(procId) {
  const ot = db.ots.find(o => o.id === currentOT);
  if(!ot) return;
  // If it was excluded, un-exclude it (restore auto-match)
  if((ot.excludedProcs||[]).includes(procId)) {
    ot.excludedProcs = ot.excludedProcs.filter(id => id !== procId);
    saveDB(); renderTab(); return;
  }
  // Otherwise add as manual
  toggleManualProc(procId);
}

function toggleManualProc(procId) {
  const ot = db.ots.find(o => o.id === currentOT);
  if(!ot) return;
  if(!ot.manualProcs) ot.manualProcs = [];
  const proc = (db.procedures||[]).find(p => p.id === procId);
  const idx = ot.manualProcs.indexOf(procId);
  const isRemoving = idx >= 0;

  if(isRemoving) {
    ot.manualProcs.splice(idx, 1);
    // Remove associated databook items only if no other assigned proc of the same type remains
    if(proc) {
      const sameTypeStillAssigned = (db.procedures||[]).some(p =>
        p.type === proc.type && p.id !== procId &&
        (ot.manualProcs.includes(p.id) || procMatchesOT(p, ot))
      );
      if(!sameTypeStillAssigned) {
        const itemsToRemove = PROC_TYPE_TO_ITEMS[proc.type] || [];
        itemsToRemove.forEach(item => {
          // Only remove if it was manually added (not in DEFAULT_ITEMS and not detected by F-07 keywords)
          if(DEFAULT_ITEMS.includes(item)) return;
          if(ot.items) {
            const i = ot.items.indexOf(item);
            if(i >= 0) ot.items.splice(i, 1);
          }
        });
      }
    }
  } else {
    ot.manualProcs.push(procId);
    // Add associated databook items to ot.items
    if(proc) {
      if(!ot.items) ot.items = [...DEFAULT_ITEMS];
      const itemsToAdd = PROC_TYPE_TO_ITEMS[proc.type] || [];
      itemsToAdd.forEach(item => {
        if(!ot.items.includes(item)) ot.items.push(item);
      });
      // Re-sort according to canonical ALL_ITEMS order
      sortItems(ot);
    }
  }
  saveDB();
  renderTab();
}

function procButtons(p) {
  return `<div style="display:flex;gap:5px;flex-shrink:0">
    <button class="btn btn-secondary btn-sm" title="Imprimir" onclick="printProc('${p.id}')" style="padding:5px 8px">
      <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
    </button>
    <button class="btn btn-secondary btn-sm" title="Descargar" onclick="downloadProc('${p.id}')" style="padding:5px 8px">
      <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M5 20h14v-2H5v2zm7-18v10.59l-3.29-3.3-1.42 1.42L12 16l4.71-4.71-1.42-1.42L13 13.17V2h-1z"/></svg>
    </button>
  </div>`;
}

function renderTabProcedimientos(ot, el) {
  const allProcs = db.procedures || [];
  const autoMatched = allProcs.filter(p => procMatchesOT(p, ot));
  const autoIds = new Set(autoMatched.map(p => p.id));
  const manualIds = ot.manualProcs || [];
  const manualOnly = allProcs.filter(p => manualIds.includes(p.id) && !autoIds.has(p.id));
  const assignable = allProcs.filter(p => !autoIds.has(p.id) && !manualIds.includes(p.id));
  const assigned = [...autoMatched, ...manualOnly];
  const f07Loaded = Array.isArray(ot.items);

  // Sort helpers
  const alpha = arr => [...arr].sort((a,b) => a.name.localeCompare(b.name, 'es'));

  // Single proc card row
  const assignedCard = (p) => {
    const isAuto = autoIds.has(p.id);
    // Si es un WPS, mostrar debajo los soldadores con WPQ para ese PST
    let wpqBlock = '';
    if(typeof procCategory==='function' && procCategory(p.type) === 'Procedimiento de Soldadura (WPS/PQR)'
       && typeof extractPSTFromFilename==='function' && typeof wpqBlockForOT==='function') {
      const pst = extractPSTFromFilename(p.filename || p.name || '');
      if(pst) wpqBlock = wpqBlockForOT(pst);
    }
    return `<div class="proc-card ${isAuto?'proc-matched':''}"
      style="${!isAuto?'border-color:var(--amber);background:var(--amber-light)':''};flex-wrap:wrap">
      <div class="proc-icon" style="font-size:16px">${p.fileType==='pdf'?'📕':'📘'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500">${esc(p.name)}</div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:2px">
          <span class="proc-type-badge" ${!isAuto?'style="background:var(--amber);color:white"':''}>${esc(p.type)}</span>
          <span style="font-size:10px;color:var(--text3)">${isAuto?'automático':'manual'}</span>
        </div>
      </div>
      <div style="display:flex;gap:5px;align-items:center;flex-shrink:0">
        ${procButtons(p)}
        <button class="btn btn-danger btn-sm" title="Quitar"
          onclick="unassignProc('${p.id}')" style="padding:5px 8px">✕</button>
      </div>
      ${wpqBlock ? `<div style="flex-basis:100%;width:100%">${wpqBlock}</div>` : ''}
    </div>`;
  };

  const availCard = (p) => `
    <div class="proc-card" style="opacity:.8">
      <div class="proc-icon" style="font-size:16px">${p.fileType==='pdf'?'📕':'📘'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500">${esc(p.name)}</div>
        <span class="proc-type-badge" style="background:var(--border);color:var(--text3)">${esc(p.type)}</span>
      </div>
      <div style="display:flex;gap:5px;align-items:center">
        ${procButtons(p)}
        <button class="btn btn-secondary btn-sm"
          onclick="toggleManualProc('${p.id}')"
          style="padding:5px 10px;font-size:12px">+ Asignar</button>
      </div>
    </div>`;

  // Build accordion section per category
  const WPS_NOTE = ot.f07text ? 'No se encontraron PSTs coincidentes en el F-07. Podés asignarlos manualmente desde abajo.' : 'Cargá el F-07 para asignación automática por número de PST, o asignalos manualmente.';
  const accordion = (id, title, procs, renderCard, emptyMsg='') => {
    if(!procs.length && !emptyMsg) return '';
    const open = false;
    return `
      <details ${open?'open':''} style="margin-bottom:8px">
        <summary style="cursor:pointer;user-select:none;list-style:none;
          display:flex;align-items:center;justify-content:space-between;
          padding:10px 14px;background:var(--surface2);border:1px solid var(--border);
          border-radius:var(--r);font-size:13px;font-weight:600;color:var(--text)">
          <span>${title}</span>
          <span style="display:flex;align-items:center;gap:8px">
            ${procs.length?`<span class="chip">${procs.length}</span>`:''}
            <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"
              style="transition:transform .2s;transform:rotate(0deg)" class="acc-arrow">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </span>
        </summary>
        <div style="border:1px solid var(--border);border-top:none;border-radius:0 0 var(--r) var(--r);
          padding:10px;display:flex;flex-direction:column;gap:7px">
          ${procs.length ? alpha(procs).map(renderCard).join('') :
            `<p style="font-size:13px;color:var(--text3);margin:4px 0">${emptyMsg}</p>`}
        </div>
      </details>`;
  };

  // Group by category
  const groupByCat = (procs) => {
    const r = {};
    Object.keys(PROC_CATEGORIES).forEach(c => r[c]=[]);
    procs.forEach(p => { const c=procCategory(p.type); if(!r[c])r[c]=[]; r[c].push(p); });
    return r;
  };

  const assignedByCat = groupByCat(assigned);
  const availByCat = groupByCat(assignable);
  const totalAssigned = assigned.length;
  const totalAvail = assignable.length;

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Asignados a esta OT
          ${totalAssigned?`<span class="chip" style="margin-left:6px">${totalAssigned}</span>`:''}
        </span>
        <button class="btn btn-secondary btn-sm" onclick="showProceduresView()">📋 Biblioteca</button>
      </div>

      ${!f07Loaded && !totalAssigned ? `
        <div style="padding:12px;background:var(--surface2);border-radius:var(--r);
          border:1px dashed var(--border);font-size:13px;color:var(--text3);text-align:center">
          Cargá el F-07 para asignar procedimientos automáticamente, o asignalos manualmente desde abajo.
        </div>` :
        totalAssigned === 0 ? `
        <p style="font-size:13px;color:var(--text3)">
          Sin procedimientos asignados. Podés agregarlos desde la sección de disponibles.
        </p>` :
        Object.entries(assignedByCat).map(([cat, procs]) =>
          accordion('asgn-'+cat, cat, procs, assignedCard,
            cat === 'Procedimiento de Soldadura (WPS/PQR)' ? WPS_NOTE : '')
        ).join('')}
    </div>

    ${allProcs.length === 0 ? `
      <div class="card" style="border-style:dashed">
        <p style="font-size:13px;color:var(--text3)">
          <a href="#" onclick="showProceduresView();return false;" style="color:var(--accent)">
            Cargá procedimientos en la biblioteca →
          </a>
        </p>
      </div>` : totalAvail > 0 ? `
      <div class="card">
        <div class="card-header">
          <span class="card-title" style="color:var(--text2)">Disponibles para asignar
            <span class="chip" style="margin-left:6px">${totalAvail}</span>
          </span>
        </div>
        ${Object.entries(availByCat).map(([cat, procs]) =>
          accordion('avail-'+cat, cat, procs, availCard)
        ).join('')}
      </div>` : ''}`;

  // Rotate arrows on open/close
  el.querySelectorAll('details').forEach(d => {
    const arrow = d.querySelector('.acc-arrow');
    d.addEventListener('toggle', () => {
      if(arrow) arrow.style.transform = d.open ? 'rotate(180deg)' : 'rotate(0deg)';
    });
    if(d.open && arrow) arrow.style.transform = 'rotate(180deg)';
  });
}

function openAssignProcModal() {
  // Just scroll to the available section
  const el = document.querySelector('.card[style*="dashed"]');
  if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
}

function buildTypeSelect() {
  const sel = document.getElementById('proc-type-select');
  if(!sel) return;
  const custom = (db.customProcTypes || []).map(t => typeof t === 'string' ? t : t.name);
  const current = sel.value;
  sel.innerHTML = `
    <optgroup label="Procedimientos de Ensayos">
      <option>Líquidos Penetrantes</option>
      <option>Radiografía / Gammagrafía</option>
      <option>Ultrasonido</option>
      <option>Visual de Soldaduras</option>
      <option>Dimensional</option>
      <option>Prueba Hidráulica</option>
      <option>Prueba Neumática</option>
      ${custom.length>0 ? custom.map(t=>`<option>${t}</option>`).join('') : ''}
    </optgroup>
    <optgroup label="Pintura / Tratamiento Superficial">
      <option>Pintura</option>
      <option>Galvanizado</option>
      <option>Decapado y Pasivado</option>
    </optgroup>
    <optgroup label="Soldadura">
      <option>WPS / Soldadura</option>
    </optgroup>
    <option disabled style="color:var(--border)">──────────</option>
    <option value="__custom__">+ Nuevo tipo personalizado...</option>`;
  // Restore selection if still valid
  if(current && current !== '__custom__') {
    try { sel.value = current; } catch(e) {}
  }
}

function onProcTypeChange(val) {
  const customField = document.getElementById('custom-type-field');
  if(val === '__custom__') {
    customField.style.display = 'block';
    setTimeout(() => document.getElementById('custom-type-input').focus(), 50);
  } else {
    customField.style.display = 'none';
  }
}

function confirmCustomType() {
  const name = document.getElementById('custom-type-input').value.trim().toUpperCase();
  if(!name) { document.getElementById('custom-type-input').focus(); return; }

  // Parse keywords: split by comma, normalize each
  const kwRaw = document.getElementById('custom-type-kw').value.trim();
  let keywords = kwRaw
    ? kwRaw.split(',').map(k => k.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9 ]/g,'').trim()).filter(k => k)
    : [];
  // Always include the name itself as a keyword
  const nameNorm = name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9 ]/g,'').trim();
  if(!keywords.includes(nameNorm)) keywords.unshift(nameNorm);

  if(!db.customProcTypes) db.customProcTypes = [];
  // Update or add
  const existing = db.customProcTypes.find(t => t.name === name);
  if(existing) {
    existing.keywords = keywords;
  } else {
    db.customProcTypes.push({name, keywords});
  }
  PROC_ITEM_MAP[name] = keywords;
  saveDB();
  buildTypeSelect();
  document.getElementById('proc-type-select').value = name;
  document.getElementById('custom-type-field').style.display = 'none';
  document.getElementById('custom-type-kw').value = '';
  document.getElementById('custom-type-input').value = '';
  document.getElementById('custom-type-kw').value = '';
}

function openAddProcModal() {
  document.getElementById('proc-name-input').value = '';
  document.getElementById('proc-file-label').textContent = 'Ningún archivo seleccionado';
  document.getElementById('proc-file-label').style.color = 'var(--text3)';
  document.getElementById('custom-type-field').style.display = 'none';
  window._pendingProcFile = null;
  buildTypeSelect();
  // Pre-select a type matching the active section
  const sectionDefaults = {
    'END': 'Líquidos Penetrantes',
    'Tratamiento Superficial': 'Pintura',
    'WPS y PQR': 'WPS / Soldadura'
  };
  document.getElementById('proc-type-select').value = sectionDefaults[currentProcSection] || 'Líquidos Penetrantes';
  // For WPS section there is only one type — hide the selector entirely
  const typeField = document.getElementById('single-file-type');
  if(currentProcSection === 'WPS y PQR') {
    document.getElementById('proc-type-select').value = 'WPS / Soldadura';
    if(typeField) typeField.style.display = 'none';
  } else {
    if(typeField) typeField.style.display = '';
  }
  document.getElementById('modal-add-proc').style.display = 'flex';
  setTimeout(() => document.getElementById('proc-name-input').focus(), 50);
}

function closeAddProcModal() {
  document.getElementById('modal-add-proc').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('proc-file-input').addEventListener('change', function() {
    const files = Array.from(this.files);
    if(!files.length) return;

    if(files.length === 1) {
      // Single file mode: classic behaviour
      window._pendingProcFiles = null;
      window._pendingProcFile = files[0];
      document.getElementById('proc-file-label').textContent = files[0].name;
      document.getElementById('proc-file-label').style.color = 'var(--accent)';
      document.getElementById('single-file-name').style.display = 'block';
      document.getElementById('single-file-type').style.display = 'block';
      document.getElementById('proc-files-list').style.display = 'none';
      const nameEl = document.getElementById('proc-name-input');
      if(!nameEl.value) nameEl.value = files[0].name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    } else {
      // Multi-file mode: show per-file rows
      window._pendingProcFile = null;
      window._pendingProcFiles = files;
      document.getElementById('proc-file-label').textContent = files.length + ' archivos seleccionados';
      document.getElementById('proc-file-label').style.color = 'var(--accent)';
      document.getElementById('single-file-name').style.display = 'none';
      document.getElementById('single-file-type').style.display = 'none';
      document.getElementById('custom-type-field').style.display = 'none';
      buildMultiFileRows(files);
    }
  });
});

function buildMultiFileRows(files) {
  const container = document.getElementById('proc-files-list');
  container.style.display = 'flex';
  const isWPS = (currentProcSection === 'WPS y PQR');
  const typeOptions = `
    <optgroup label="Ensayos">
      <option>Líquidos Penetrantes</option>
      <option>Radiografía / Gammagrafía</option>
      <option>Ultrasonido</option>
      <option>Visual de Soldaduras</option>
      <option>Dimensional</option>
      <option>Prueba Hidráulica</option>
      <option>Prueba Neumática</option>
    </optgroup>
    <optgroup label="Pintura">
      <option>Pintura</option>
      <option>Galvanizado</option>
      <option>Decapado y Pasivado</option>
    </optgroup>
    <optgroup label="Soldadura">
      <option>WPS / Soldadura</option>
    </optgroup>`;
  // "Apply to all" header — hidden for WPS (single type)
  const applyAll = isWPS ? '' : `
    <div style="background:var(--accent-light);border:1px solid var(--accent-soft);border-radius:var(--r);padding:10px 12px;margin-bottom:4px">
      <div style="font-size:11px;font-weight:600;color:var(--accent);margin-bottom:6px">⚡ Aplicar un tipo a todos los archivos</div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="mf-apply-all-type" style="flex:1;font-size:12px;padding:6px 8px">${typeOptions}</select>
        <button class="btn btn-primary btn-sm" onclick="applyTypeToAll()" style="white-space:nowrap">Aplicar a todos</button>
      </div>
    </div>`;
  const rows = applyAll + files.map((f, i) => {
    const nameDefault = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').toUpperCase();
    return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:10px 12px">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:500">
        ${f.fileType==='pdf'?'📕':'📘'} ${f.name}
      </div>
      <div style="display:grid;grid-template-columns:${isWPS?'1fr':'1fr 1fr'};gap:8px">
        <div>
          <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);margin-bottom:3px">Nombre</div>
          <input type="text" value="${nameDefault}" id="mf-name-${i}"
            style="width:100%;font-size:12px;padding:5px 8px"
            oninput="this.value=this.value.toUpperCase()">
        </div>
        ${isWPS ? `<input type="hidden" id="mf-type-${i}" value="WPS / Soldadura">` : `<div>
          <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);margin-bottom:3px">Tipo</div>
          <select id="mf-type-${i}" style="width:100%;font-size:12px;padding:5px 8px">${typeOptions}</select>
        </div>`}
      </div>
    </div>`;
  }).join('');
  container.innerHTML = rows;
}

function applyTypeToAll() {
  const type = document.getElementById('mf-apply-all-type').value;
  const selects = document.querySelectorAll('[id^="mf-type-"]');
  selects.forEach(sel => { sel.value = type; });
}

async function saveMultipleProcs() {
  const files = window._pendingProcFiles;
  const btn = document.querySelector('#modal-add-proc .btn-primary');
  btn.disabled = true;

  let saved = 0;
  for(let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = (document.getElementById('mf-name-' + i)?.value || '').trim();
    const type = document.getElementById('mf-type-' + i)?.value || 'Líquidos Penetrantes';
    if(!name) continue;

    btn.textContent = `Guardando ${i+1}/${files.length}...`;
    try {
      const fileType = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';
      const mimeType = file.type || (fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      const procId = 'proc_' + Date.now() + '_' + i;
      const arrayBuffer = await file.arrayBuffer();
      const bytesArr = new Uint8Array(arrayBuffer);
      let b64 = '';
      const CHUNK = 8192;
      for(let j = 0; j < bytesArr.length; j += CHUNK){
        b64 += String.fromCharCode(...bytesArr.subarray(j, j + CHUNK));
      }
      b64 = btoa(b64);
      await idbSave(procId, b64, mimeType, file.name);
      if(!db.procedures) db.procedures = [];
      const newProc = { id: procId, name, type, fileType, filename: file.name,
        date: new Date().toLocaleDateString('es-AR'), mimeType };
      db.procedures.push(newProc);
      pushProc(newProc);
      saved++;
    } catch(e) {
      console.error('Error saving', file.name, e);
    }
  }

  saveDB();
  window._pendingProcFiles = null;
  btn.disabled = false;
  btn.textContent = 'Guardar';
  closeAddProcModal();
  updateProcsSidebarCount();
  if(currentOT) renderTab(); else renderProceduresLibrary();
}

async function saveProc() {
  // Multi-file mode
  if(window._pendingProcFiles && window._pendingProcFiles.length > 0) {
    await saveMultipleProcs();
    return;
  }
  const name = document.getElementById('proc-name-input').value.trim();
  // If user typed a custom type but didn't press Enter, confirm it now
  let type = document.getElementById('proc-type-select').value;
  if(type === '__custom__') {
    const customName = document.getElementById('custom-type-input').value.trim().toUpperCase();
    if(!customName) { alert('Ingresá el nombre del tipo personalizado.'); return; }
    confirmCustomType();
    type = customName;
  }
  const file = window._pendingProcFile;
  if(!name) { alert('Ingresá un nombre para el procedimiento.'); return; }
  if(!file) { alert('Seleccioná un archivo.'); return; }

  const btn = document.querySelector('#modal-add-proc .btn-primary');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const fileType = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';
    const mimeType = file.type || (fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const procId = 'proc_' + Date.now();

    // Read file as ArrayBuffer and store in IndexedDB (no localStorage size limit)
    const arrayBuffer = await file.arrayBuffer();
    // Convert to base64 in chunks to avoid call stack overflow on large files
    const bytes = new Uint8Array(arrayBuffer);
    let b64 = '';
    const CHUNK = 8192;
    for(let i = 0; i < bytes.length; i += CHUNK){
      b64 += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    b64 = btoa(b64);
    await idbSave(procId, b64, mimeType, file.name);

    const proc = {
      id: procId,
      name, type, fileType,
      filename: file.name,
      date: new Date().toLocaleDateString('es-AR'),
      mimeType
      // data NOT stored here — lives in IndexedDB
    };

    if(!db.procedures) db.procedures = [];
    db.procedures.push(proc);
    saveDB();
    pushProc(proc);
    closeAddProcModal();
    window._pendingProcFile = null;
    // Re-render current view
    updateProcsSidebarCount();
    if(currentOT) renderTab();
    else renderProceduresLibrary();
  } catch(err) {
    alert('Error al guardar: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function downloadProc(id) {
  const proc = (db.procedures||[]).find(p => p.id === id);
  if(!proc) return;
  try {
    const record = await idbGet(id);
    if(!record) { alert('Archivo no encontrado. Es posible que haya sido cargado en otro navegador.'); return; }
    const bytes = Uint8Array.from(atob(record.data), c => c.charCodeAt(0));
    const blob = new Blob([bytes], {type: proc.mimeType});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = proc.filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch(e) { alert('Error al descargar: ' + e.message); }
}

async function printProc(id) {
  const proc = (db.procedures||[]).find(p => p.id === id);
  if(!proc) return;
  try {
    const record = await idbGet(id);
    if(!record) { alert('Archivo no encontrado.'); return; }
    const bytes = Uint8Array.from(atob(record.data), c => c.charCodeAt(0));
    const blob = new Blob([bytes], {type: proc.mimeType});
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if(win) { win.addEventListener('load', () => { try{ win.print(); } catch(e){} }); }
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  } catch(e) { alert('Error al imprimir: ' + e.message); }
}

async function deleteProc(id) {
  if(!confirm('¿Eliminar este procedimiento de la biblioteca?')) return;
  const proc = (db.procedures||[]).find(p => p.id === id);
  db.procedures = (db.procedures||[]).filter(p => p.id !== id);
  saveDB();
  if(proc) deleteProcFromCloud(proc);
  try { await idbDelete(id); } catch(e) { console.warn('IDB delete:', e); }
  updateProcsSidebarCount();
  if(currentOT) renderTab();
  else renderProceduresLibrary();
}

// ── Modals ───────────────────────────────────────────────────────────────────────

