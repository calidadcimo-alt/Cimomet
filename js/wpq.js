// ════════════════════════════════════════════════════════════
// wpq.js — Calificaciones de soldadores (WPQ)
// Navegación tipo explorador: PST → soldadores → archivos
// ════════════════════════════════════════════════════════════

// Estado de navegación del explorador WPQ
let wpqNav = { level: 'pst', pst: null, soldador: null };
let wpqScrollMemory = {}; // recuerda el scroll por nivel

// ── Sincronización con la nube (tabla wpq) ───────────────────

// Sube un registro WPQ (un soldador para un PST) inmediatamente
async function pushWPQ(entry) {
  if(!syncEnabled || !entry) return;
  try {
    const row = {
      id: entry.id,
      pst: entry.pst,
      soldador: entry.soldador,
      files: entry.files || [],
      updated_at: new Date().toISOString()
    };
    const r = await fetch(SUPA_URL + '/rest/v1/wpq?on_conflict=id', {
      method: 'POST',
      headers: supaHeaders({'Prefer':'resolution=merge-duplicates,return=minimal'}),
      body: JSON.stringify(row)
    });
    if(!r.ok) console.error('[pushWPQ]', r.status, await r.text());
  } catch(e) { console.error('[pushWPQ]', e); }
}

// Borra un registro WPQ de la nube
async function deleteWPQFromCloud(id) {
  if(!syncEnabled || !id) return;
  try {
    await fetch(SUPA_URL + '/rest/v1/wpq?id=eq.' + id, {method:'DELETE', headers: supaHeaders()});
  } catch(e) {}
}

// Baja todos los WPQ de la nube (se llama desde syncFromCloud)
async function fetchWPQFromCloud() {
  try {
    const r = await fetch(SUPA_URL + '/rest/v1/wpq?select=*', {headers: supaHeaders()});
    if(!r.ok) return null;
    return await r.json();
  } catch(e) { return null; }
}

// ── Helpers de datos ─────────────────────────────────────────

// Normaliza un PST para comparar (igual criterio que los WPS)
function wpqNormPST(pst) {
  return normPST(pst || '');
}

// Lista de PSTs derivados de los WPS cargados en la biblioteca de procedimientos
function wpqPSTsFromWPS() {
  const psts = {};
  (db.procedures || []).forEach(p => {
    if(typeof procCategory === 'function' && procCategory(p.type) === 'Procedimiento de Soldadura (WPS/PQR)') {
      const pst = (typeof extractPSTFromFilename === 'function')
        ? extractPSTFromFilename(p.filename || p.name || '') : null;
      if(pst) psts[pst] = true;
    }
  });
  return Object.keys(psts);
}

// Lista de PSTs únicos que tienen al menos un WPQ
function wpqAllPSTs() {
  const psts = {};
  // Primero, todos los PST que existen como WPS cargados (carpetas vacías a la espera)
  wpqPSTsFromWPS().forEach(pst => { psts[pst] = []; });
  // Luego, sumar los WPQ ya cargados (pueden tener PST que coincida o no)
  (db.wpq || []).forEach(e => {
    const key = e.pst || '(sin PST)';
    if(!psts[key]) psts[key] = [];
    psts[key].push(e);
  });
  return psts;
}

// Soldadores de un PST dado
function wpqSoldadoresFor(pst) {
  return (db.wpq || []).filter(e => e.pst === pst);
}

// Soldadores cuyo PST coincide (normalizado) con el de un WPS asignado
function wpqSoldadoresForWPSNum(pstNum) {
  const target = wpqNormPST(pstNum);
  if(!target) return [];
  return (db.wpq || []).filter(e =>
    wpqNormPST(e.pst) === target &&
    !/^inactivos?$/i.test((e.soldador || '').trim())   // no mostrar la carpeta INACTIVOS en la OT
  );
}

// ── Vista principal (sidebar WPQ) ────────────────────────────

function showWPQView() {
  currentOT = null;
  currentTab = 'datos';
  currentScreen = 'wpq';
  if(typeof updateHomeButton==='function') updateHomeButton();
  document.querySelectorAll('.ot-item').forEach(el => el.classList.remove('active'));
  document.getElementById('sidebar-proc-wpq')?.classList.add('active');
  wpqNav = { level: 'pst', pst: null, soldador: null };
  renderWPQ();
}

function renderWPQ() {
  const titleEl = document.getElementById('topbar-title');
  const actionsEl = document.getElementById('topbar-actions');
  if(titleEl) titleEl.textContent = 'WPQ — Calificación de soldadores';

  // El banner de vencimientos solo se muestra en el nivel 1 (lista de PST)
  if(wpqNav.level !== 'pst') {
    const slot = document.getElementById('wpq-banner-slot');
    if(slot){ slot.style.display = 'none'; slot.innerHTML = ''; }
  }

  if(wpqNav.level === 'pst') {
    if(actionsEl) actionsEl.innerHTML =
      `<button class="btn btn-secondary btn-sm" onclick="showProceduresMenu()">← Procedimientos</button>
       <button class="btn btn-secondary btn-sm" onclick="document.getElementById('venc-excel-input').click()">📊 Importar vencimientos (Excel)</button>`;
    renderWPQpstLevel();
  } else if(wpqNav.level === 'soldadores') {
    if(actionsEl) actionsEl.innerHTML =
      `<button class="btn btn-primary btn-sm" onclick="document.getElementById('wpq-folder-input').click()">⬆ Cargar carpeta(s)</button>`;
    renderWPQsoldadoresLevel();
  } else if(wpqNav.level === 'archivos') {
    if(actionsEl) actionsEl.innerHTML = '';
    renderWPQarchivosLevel();
  }
}

// ── NIVEL 1: carpetas de PST ─────────────────────────────────

function renderWPQpstLevel() {
  const psts = wpqAllPSTs();
  const keys = Object.keys(psts).sort();
  const main = document.getElementById('main-content');

  let cards = '';
  if(keys.length === 0) {
    cards = `<div class="empty fade-in" style="padding:40px">
      <div class="empty-icon">📁</div>
      <h3>Sin carpetas de WPS todavía</h3>
      <p>Las carpetas se crean automáticamente al cargar procedimientos WPS.<br>
      Cargá un WPS en la sección "WPS y PQR" y su carpeta aparecerá acá.</p>
    </div>`;
  } else {
    cards = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">` +
      keys.map(pst => {
        const count = psts[pst].length;
        const tieneSold = count > 0;
        return `<div class="wpq-folder" onclick="wpqOpenPST('${escAttr(pst)}')">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="${tieneSold?'var(--accent)':'var(--text3)'}" style="margin:0 auto">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
          <div style="font-size:13px;font-weight:600;margin-top:8px">PST ${esc(pst)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${count} soldador${count===1?'':'es'}</div>
        </div>`;
      }).join('') + `</div>`;
  }

  main.innerHTML = `<div class="fade-in">
    <div style="margin-bottom:16px;color:var(--text2);font-size:13px">
      Una carpeta por cada WPS cargado (por número PST). Hacé click para ver y cargar los soldadores calificados.
    </div>
    ${cards}
    <input type="file" id="venc-excel-input" accept=".xls,.xlsx" style="display:none"
      onchange="if(this.files[0]) importVencimientosExcel(this.files[0])">
  </div>`;

  // Banner de vencimientos en el slot fijo (fuera del scroll)
  const slot = document.getElementById('wpq-banner-slot');
  if(slot){ slot.innerHTML = vencimientosBannerHTML(); slot.style.display = 'block'; }
}

function wpqOpenPST(pst) {
  const c = document.getElementById('main-content');
  if(c) wpqScrollMemory['pst'] = c.scrollTop;
  wpqNav = { level: 'soldadores', pst: pst, soldador: null };
  renderWPQ();
}

// ── NIVEL 2: carpetas de soldadores ──────────────────────────

function renderWPQsoldadoresLevel() {
  const soldadores = wpqSoldadoresFor(wpqNav.pst);
  const main = document.getElementById('main-content');

  // Breadcrumb + back
  const bc = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button class="btn btn-secondary btn-sm" onclick="wpqBack()">← Volver</button>
    <span style="font-size:13px;color:var(--text2)">WPQ / <strong style="color:var(--text)">PST ${esc(wpqNav.pst)}</strong></span>
  </div>`;

  let cards = '';
  if(soldadores.length === 0) {
    cards = `<div class="empty fade-in" style="padding:40px">
      <div class="empty-icon">👷</div>
      <h3>Sin soldadores en esta carpeta</h3>
      <p>Usá "Cargar carpeta(s)" para subir soldadores. Podés seleccionar:<br>
      • Una carpeta de PST que contenga varias carpetas de soldadores, o<br>
      • La carpeta de un solo soldador (ej: "Juan Pérez") con sus archivos.<br>
      El nombre de cada carpeta será el nombre del soldador.</p>
    </div>`;
  } else {
    cards = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">` +
      soldadores.map(s => {
        const n = (s.files||[]).length;
        return `<div class="wpq-folder" onclick="wpqOpenSoldador('${escAttr(s.id)}')">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="${n>0?'var(--accent)':'var(--text3)'}" style="margin:0 auto">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
          <div style="font-size:13px;font-weight:600;margin-top:8px">${esc(s.soldador)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${n} archivo${n===1?'':'s'}</div>
          <button onclick="event.stopPropagation();deleteSoldador('${escAttr(s.id)}')"
            style="margin-top:8px;font-size:10px;color:var(--red);background:none;border:none;cursor:pointer">eliminar</button>
        </div>`;
      }).join('') + `</div>`;
  }

  main.innerHTML = `<div class="fade-in">${bc}${cards}
    <input type="file" id="wpq-folder-input" webkitdirectory directory multiple
      style="display:none" onchange="handleWPQFolderUpload(this.files)">
  </div>`;
}

function wpqOpenSoldador(id) {
  const c = document.getElementById('main-content');
  if(c) wpqScrollMemory['soldadores:' + wpqNav.pst] = c.scrollTop;
  wpqNav = { level: 'archivos', pst: wpqNav.pst, soldador: id };
  renderWPQ();
}

// ── NIVEL 3: archivos del soldador ───────────────────────────

function renderWPQarchivosLevel() {
  const entry = (db.wpq||[]).find(e => e.id === wpqNav.soldador);
  const main = document.getElementById('main-content');
  if(!entry) { wpqBack(); return; }

  const isInactivos = /^inactivos?$/i.test((entry.soldador||'').trim());

  // Estado de vencimiento actual de este soldador para este PST
  let vencInfo = '';
  let revalBtn = '';
  if(!isInactivos) {
    const regs = (db.vencimientos||[]).filter(v =>
      v.pst === entry.pst &&
      (v.soldador||'').toLowerCase() === (entry.soldador||'').toLowerCase());
    if(regs.length) {
      const partes = regs.map(v => {
        const e = vencEstado(v);
        const color = e==='vencido'?'var(--red)':(e==='porvencer'?'var(--amber)':'var(--green)');
        const txt = e==='vencido'?'vencido':(e==='porvencer'?'vence este mes':'vigente');
        const fecha = (v.mes&&v.anio)?` (${String(v.mes).padStart(2,'0')}/${v.anio})`:'';
        return `<span style="color:${color}">${v.posicion||'—'}: ${txt}${fecha}</span>`;
      }).join(' · ');
      vencInfo = `<div style="font-size:11px;margin-top:4px">${partes}</div>`;
    }
    revalBtn = `<button class="btn btn-primary btn-sm" onclick="revalidarSoldador('${escAttr(entry.soldador)}','${escAttr(entry.pst)}')" style="margin-left:auto">↻ Revalidar</button>`;
  }

  const bc = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button class="btn btn-secondary btn-sm" onclick="wpqBack()">← Volver</button>
    <div style="min-width:0">
      <span style="font-size:13px;color:var(--text2)">WPQ / PST ${esc(entry.pst)} / <strong style="color:var(--text)">${esc(entry.soldador)}</strong></span>
      ${vencInfo}
    </div>
    ${revalBtn}
  </div>`;

  const hint = isInactivos
    ? `<div style="font-size:12px;color:var(--text2);background:var(--surface2);border-radius:var(--r);padding:8px 12px;margin-bottom:12px">
        Esta carpeta agrupa archivos sin soldador asignado. Usá "mover" para sacar un archivo a su soldador.
      </div>` : '';

  let files = '';
  if((entry.files||[]).length === 0) {
    files = `<div style="color:var(--text3);font-size:13px;padding:20px">Este soldador no tiene archivos cargados.</div>`;
  } else {
    files = `<div style="display:flex;flex-direction:column;gap:6px">` +
      entry.files.map(f => `<div style="display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:10px 12px">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--accent)"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
          <span style="font-size:13px;flex:1">${esc(f.name)}</span>
          ${isInactivos ? `<button class="btn btn-secondary btn-sm" title="Mover a un soldador" onclick="moveWPQFileOut('${escAttr(entry.id)}','${escAttr(f.id)}')" style="padding:4px 8px">↗ mover</button>` : ''}
          <button class="btn btn-secondary btn-sm" title="Ver" onclick="viewWPQFile('${escAttr(entry.id)}','${escAttr(f.id)}')" style="padding:4px 8px">👁</button>
          <button class="btn btn-secondary btn-sm" title="Descargar" onclick="downloadWPQFile('${escAttr(entry.id)}','${escAttr(f.id)}')" style="padding:4px 8px">⬇</button>
          <button class="btn btn-secondary btn-sm" title="Imprimir" onclick="printWPQFile('${escAttr(entry.id)}','${escAttr(f.id)}')" style="padding:4px 8px">🖨</button>
          <button class="btn btn-secondary btn-sm" title="Eliminar archivo" onclick="deleteWPQFile('${escAttr(entry.id)}','${escAttr(f.id)}')" style="padding:4px 8px;color:var(--red)">🗑</button>
        </div>`).join('') + `</div>`;
  }

  main.innerHTML = `<div class="fade-in">${bc}${hint}${files}</div>`;
}

// Mueve un archivo desde INACTIVOS hacia un soldador (existente o nuevo) en el mismo PST
function moveWPQFileOut(fromId, fileId) {
  const fromEntry = (db.wpq||[]).find(e => e.id === fromId);
  if(!fromEntry) return;
  const fileMeta = (fromEntry.files||[]).find(f => f.id === fileId);
  if(!fileMeta) return;

  // Soldadores existentes en este PST (excluyendo INACTIVOS)
  const others = (db.wpq||[]).filter(e =>
    e.pst === fromEntry.pst && e.id !== fromId &&
    !/^inactivos?$/i.test((e.soldador||'').trim())
  );
  let listed = others.map((e,i) => `${i+1}. ${e.soldador}`).join('\n');
  const promptMsg = `Mover "${fileMeta.name}" a un soldador del PST ${fromEntry.pst}.\n\n` +
    (others.length ? `Escribí el número de un soldador existente:\n${listed}\n\nO escribí un nombre nuevo:` :
     `Escribí el nombre del soldador:`);
  const answer = prompt(promptMsg);
  if(answer === null) return;
  const val = answer.trim();
  if(!val) return;

  // ¿Eligió un número de la lista?
  let target = null;
  const num = parseInt(val, 10);
  if(others.length && /^\d+$/.test(val) && num >= 1 && num <= others.length) {
    target = others[num-1];
  } else {
    // Nombre nuevo o existente por nombre
    target = (db.wpq||[]).find(e => e.pst === fromEntry.pst &&
      e.soldador.toLowerCase() === val.toLowerCase() &&
      !/^inactivos?$/i.test((e.soldador||'').trim()));
    if(!target) {
      target = { id:'wpq_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
                 pst: fromEntry.pst, soldador: val, files: [] };
      if(!db.wpq) db.wpq = [];
      db.wpq.push(target);
    }
  }

  // Mover el archivo
  target.files.push(fileMeta);
  fromEntry.files = fromEntry.files.filter(f => f.id !== fileId);

  // Persistir ambos
  pushWPQ(target);
  pushWPQ(fromEntry);
  saveDB();
  renderWPQ();
}

// ── Navegación: volver un nivel ──────────────────────────────

function wpqBack() {
  if(wpqNav.level === 'archivos') {
    wpqNav = { level: 'soldadores', pst: wpqNav.pst, soldador: null };
    renderWPQ();
    wpqRestoreScroll('soldadores:' + wpqNav.pst);
  } else if(wpqNav.level === 'soldadores') {
    wpqNav = { level: 'pst', pst: null, soldador: null };
    renderWPQ();
    wpqRestoreScroll('pst');
  }
}

function wpqRestoreScroll(key) {
  const c = document.getElementById('main-content');
  const y = wpqScrollMemory[key];
  if(c && y != null) {
    requestAnimationFrame(() => { c.scrollTop = y; });
  }
}

// ── Carga de carpetas (múltiples soldadores) ─────────────────

async function handleWPQFolderUpload(fileList) {
  if(!fileList || fileList.length === 0) return;
  const pst = wpqNav.pst;
  if(!pst) { alert('Abrí primero una carpeta de PST.'); return; }

  // Agrupar archivos por soldador. Soporta dos formas de carga:
  //  (A) Carpeta padre de PST que contiene subcarpetas de soldadores:
  //      "PST14-08/Juan Perez/archivo.pdf"  → soldador = "Juan Perez"
  //  (B) Una sola carpeta de soldador con archivos adentro:
  //      "Juan Perez/archivo.pdf"           → soldador = "Juan Perez"
  // Detectamos la profundidad máxima de las rutas para decidir.
  const paths = [];
  const IGNORE = /^(thumbs\.db|desktop\.ini|\.ds_store)$/i;
  for(const file of fileList) {
    if(IGNORE.test(file.name)) continue;        // basura del sistema (Thumbs.db, etc.)
    if(file.name.startsWith('.')) continue;       // archivos ocultos
    const rel = file.webkitRelativePath || file.name;
    paths.push({ file, parts: rel.split('/').filter(Boolean) });
  }
  // Profundidad: cantidad de segmentos de carpeta (sin contar el archivo)
  const maxDepth = Math.max(...paths.map(p => p.parts.length));

  const bySoldador = {};
  for(const { file, parts } of paths) {
    let soldador;
    if(parts.length >= 3) {
      // raiz / soldador / (...) / archivo  → caso (A)
      soldador = parts[1];
    } else if(parts.length === 2) {
      // Puede ser caso (B): "soldador/archivo"
      // o caso (A) con archivos sueltos en la raíz: "raiz/archivo"
      // Si la carga tiene profundidad máxima 2, la carpeta seleccionada ES el soldador.
      // Si hay rutas más profundas (maxDepth>=3), estos archivos sueltos van al nombre de la raíz.
      soldador = (maxDepth >= 3) ? parts[0] : parts[0];
    } else {
      // archivo suelto sin carpeta (poco común con webkitdirectory)
      soldador = 'Sin nombre';
    }
    if(!bySoldador[soldador]) bySoldador[soldador] = [];
    bySoldador[soldador].push(file);
  }

  const soldadorNames = Object.keys(bySoldador);
  if(soldadorNames.length === 0) return;

  // Indicador
  setSyncStatus('syncing', 'Subiendo carpetas…');

  let totalFiles = 0, doneFiles = 0;
  soldadorNames.forEach(s => totalFiles += bySoldador[s].length);

  for(const soldador of soldadorNames) {
    const files = bySoldador[soldador];
    // ¿Ya existe este soldador en este PST? Si sí, le agregamos archivos.
    let entry = (db.wpq||[]).find(e => e.pst === pst && e.soldador === soldador);
    const isNew = !entry;
    if(isNew) {
      entry = { id: 'wpq_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
                pst, soldador, files: [] };
    }

    for(const file of files) {
      try {
        const fileType = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'other';
        const mimeType = file.type || (fileType==='pdf' ? 'application/pdf' : 'application/octet-stream');
        const fileId = 'wpqf_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
        const ab = await file.arrayBuffer();
        const bytes = new Uint8Array(ab);
        let b64=''; const CHUNK=8192;
        for(let i=0;i<bytes.length;i+=CHUNK) b64 += String.fromCharCode.apply(null, bytes.subarray(i,i+CHUNK));
        b64 = btoa(b64);
        await idbSave(fileId, b64, mimeType, file.name);
        entry.files.push({ id: fileId, name: file.name, mimeType });
      } catch(e) {
        console.error('Error subiendo', file.name, e);
      }
      doneFiles++;
      setSyncStatus('syncing', `Subiendo ${doneFiles}/${totalFiles}…`);
    }

    if(isNew) {
      if(!db.wpq) db.wpq = [];
      db.wpq.push(entry);
    }
    pushWPQ(entry);
  }

  saveDB();
  setSyncStatus('ok', 'Guardado');
  setTimeout(()=>setSyncStatus('idle'), 2000);
  renderWPQ();
}

// ── Acciones de archivos (ver / descargar / imprimir) ────────

async function getWPQFileRecord(entryId, fileId) {
  const entry = (db.wpq||[]).find(e => e.id === entryId);
  if(!entry) return null;
  const meta = (entry.files||[]).find(f => f.id === fileId);
  if(!meta) return null;
  const record = await idbGet(fileId);
  return { record, meta };
}

async function viewWPQFile(entryId, fileId) {
  try {
    const res = await getWPQFileRecord(entryId, fileId);
    if(!res || !res.record) { alert('Archivo no encontrado.'); return; }
    const bytes = Uint8Array.from(atob(res.record.data), c => c.charCodeAt(0));
    const blob = new Blob([bytes], {type: res.meta.mimeType || 'application/pdf'});
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch(e) { alert('Error al abrir: ' + e.message); }
}

async function downloadWPQFile(entryId, fileId) {
  try {
    const res = await getWPQFileRecord(entryId, fileId);
    if(!res || !res.record) { alert('Archivo no encontrado.'); return; }
    const bytes = Uint8Array.from(atob(res.record.data), c => c.charCodeAt(0));
    const blob = new Blob([bytes], {type: res.meta.mimeType || 'application/octet-stream'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = res.meta.name;
    a.click();
    URL.revokeObjectURL(url);
  } catch(e) { alert('Error al descargar: ' + e.message); }
}

async function printWPQFile(entryId, fileId) {
  try {
    const res = await getWPQFileRecord(entryId, fileId);
    if(!res || !res.record) { alert('Archivo no encontrado.'); return; }
    const bytes = Uint8Array.from(atob(res.record.data), c => c.charCodeAt(0));
    const blob = new Blob([bytes], {type: res.meta.mimeType || 'application/pdf'});
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if(win) { win.addEventListener('load', () => { try{ win.print(); }catch(e){} }); }
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  } catch(e) { alert('Error al imprimir: ' + e.message); }
}

// Elimina un solo archivo de un soldador
function deleteWPQFile(entryId, fileId) {
  const entry = (db.wpq||[]).find(e => e.id === entryId);
  if(!entry) return;
  const meta = (entry.files||[]).find(f => f.id === fileId);
  if(!meta) return;
  if(!confirm(`¿Eliminar el archivo "${meta.name}"?`)) return;
  if(fileId) idbDelete(fileId).catch(()=>{});
  entry.files = entry.files.filter(f => f.id !== fileId);
  pushWPQ(entry);
  saveDB();
  renderWPQ();
}

// ── Eliminar ─────────────────────────────────────────────────

function deleteSoldador(id) {
  const entry = (db.wpq||[]).find(e => e.id === id);
  if(!entry) return;
  if(!confirm(`¿Eliminar al soldador ${entry.soldador} y sus archivos?`)) return;
  (entry.files||[]).forEach(f => { if(f.id) idbDelete(f.id).catch(()=>{}); });
  db.wpq = (db.wpq||[]).filter(e => e.id !== id);
  deleteWPQFromCloud(id);
  saveDB();
  renderWPQ();
}

function deletePSTFolder(pst) {
  const soldadores = wpqSoldadoresFor(pst);
  if(!confirm(`¿Eliminar la carpeta PST ${pst} con sus ${soldadores.length} soldador(es)?`)) return;
  soldadores.forEach(e => {
    (e.files||[]).forEach(f => { if(f.id) idbDelete(f.id).catch(()=>{}); });
    deleteWPQFromCloud(e.id);
  });
  db.wpq = (db.wpq||[]).filter(e => e.pst !== pst);
  saveDB();
  renderWPQ();
}

// ── Bloque de soldadores dentro de una OT (auto-asignación) ──

// Devuelve el HTML del bloque de soldadores WPQ para un PST asignado en la OT
function wpqBlockForOT(pstNum) {
  const soldadores = wpqSoldadoresForWPSNum(pstNum);
  if(soldadores.length === 0) return '';

  const rows = soldadores.map(s => {
    const filesHtml = (s.files||[]).map(f =>
      `<div style="display:flex;align-items:center;gap:8px;padding:4px 0">
        <span style="font-size:11px;color:var(--text2);flex:1">${esc(f.name)}</span>
        <button class="btn btn-secondary btn-sm" title="Ver" onclick="viewWPQFile('${escAttr(s.id)}','${escAttr(f.id)}')" style="padding:2px 7px;font-size:11px">👁</button>
        <button class="btn btn-secondary btn-sm" title="Descargar" onclick="downloadWPQFile('${escAttr(s.id)}','${escAttr(f.id)}')" style="padding:2px 7px;font-size:11px">⬇</button>
        <button class="btn btn-secondary btn-sm" title="Imprimir" onclick="printWPQFile('${escAttr(s.id)}','${escAttr(f.id)}')" style="padding:2px 7px;font-size:11px">🖨</button>
      </div>`).join('');
    return `<div style="margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--text)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text2)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        ${esc(s.soldador)}
      </div>
      <div style="padding-left:21px">${filesHtml || '<span style="font-size:11px;color:var(--text3)">Sin archivos</span>'}</div>
    </div>`;
  }).join('');

  return `<div style="margin-top:10px;background:var(--bg);border-radius:var(--r)">
    <details style="border-radius:var(--r);overflow:hidden">
      <summary style="font-size:11px;color:var(--text2);padding:10px 12px;cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;list-style:none">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text2)"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
        Soldadores calificados para PST ${esc(pstNum)}
        <span style="margin-left:auto;font-size:10px;background:var(--surface2);padding:2px 7px;border-radius:9px">${soldadores.length}</span>
      </summary>
      <div style="padding:0 12px 10px 12px">${rows}</div>
    </details>
  </div>`;
}

// Helper de escape de atributos (por si no existe en utils)
function escAttr(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════════════════════════
// VENCIMIENTOS — import de Excel, resumen y revalidación
// ════════════════════════════════════════════════════════════

// Parsea "14/08 (2G)" → { pst:"14-08", pos:"2G" }
function parsePSTposicion(wps) {
  const m = String(wps||'').match(/(\d{1,2})\s*[\/\-]\s*(\d{2,4})\s*\(?\s*([0-9][GgFf])?\s*\)?/);
  if(!m) return { pst: null, pos: '' };
  return { pst: m[1] + '-' + m[2], pos: (m[3]||'').toUpperCase() };
}

// Sube un registro de vencimiento a la nube
async function pushVencimiento(v) {
  if(!syncEnabled || !v) return;
  try {
    const row = { id: v.id, soldador: v.soldador, pst: v.pst, posicion: v.posicion||'',
      mes: v.mes||null, anio: v.anio||null, estado: v.estado||'', updated_at: new Date().toISOString() };
    const r = await fetch(SUPA_URL + '/rest/v1/vencimientos?on_conflict=id', {
      method:'POST', headers: supaHeaders({'Prefer':'resolution=merge-duplicates,return=minimal'}),
      body: JSON.stringify(row)
    });
    if(!r.ok) console.error('[pushVencimiento]', r.status, await r.text());
  } catch(e) { console.error('[pushVencimiento]', e); }
}

// Sube todos los vencimientos en lote
async function pushAllVencimientos() {
  if(!syncEnabled || !(db.vencimientos||[]).length) return;
  try {
    // Deduplicar por id (Postgres rechaza el lote si hay ids repetidos)
    const seen = {};
    db.vencimientos.forEach(v => { seen[v.id] = v; });
    const rows = Object.values(seen).map(v => ({
      id: v.id, soldador: v.soldador, pst: v.pst, posicion: v.posicion||'',
      mes: v.mes||null, anio: v.anio||null, estado: v.estado||'', updated_at: new Date().toISOString()
    }));
    const r = await fetch(SUPA_URL + '/rest/v1/vencimientos?on_conflict=id', {
      method:'POST', headers: supaHeaders({'Prefer':'resolution=merge-duplicates,return=minimal'}),
      body: JSON.stringify(rows)
    });
    if(!r.ok) console.error('[pushAllVencimientos]', r.status, await r.text());
  } catch(e) { console.error('[pushAllVencimientos]', e); }
}

// Importa el Excel de vencimientos (lee hoja "vencimientos")
async function importVencimientosExcel(file) {
  if(!file) return;
  if(typeof XLSX === 'undefined') { alert('No se pudo cargar el lector de Excel. Recargá la página.'); return; }
  setSyncStatus('syncing', 'Leyendo Excel…');
  try {
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array' });
    // Buscar la hoja "vencimientos" (case-insensitive)
    const sheetName = wb.SheetNames.find(n => /vencimiento/i.test(n)) || wb.SheetNames[0];
    const sh = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' });

    // Encontrar la fila de encabezado (donde col0 = "APELLIDO Y NOMBRE")
    let headerRow = -1;
    for(let i=0; i<rows.length; i++) {
      if(String(rows[i][0]||'').toUpperCase().includes('APELLIDO')) { headerRow = i; break; }
    }
    if(headerRow < 0) { alert('No encontré la fila de encabezados (APELLIDO Y NOMBRE) en la hoja.'); setSyncStatus('idle'); return; }

    // Columnas: 0=nombre, 4=WPS Nº, 8..19=meses 1..12, 20=AÑO, 21=ESTADO
    const nuevos = [];
    let lastNombre = '';
    for(let i=headerRow+1; i<rows.length; i++) {
      const row = rows[i];
      let nombre = String(row[0]||'').trim();
      if(nombre) lastNombre = nombre; else nombre = lastNombre; // arrastrar nombre si está vacío
      const wps = String(row[4]||'').trim();
      if(!wps) continue;
      const estado = String(row[21]||'').trim().toUpperCase();
      // mes: buscar X en columnas 8..19
      let mes = null;
      for(let c=8; c<=19; c++) {
        if(String(row[c]||'').trim().toUpperCase().includes('X')) { mes = c - 7; break; }
      }
      let anio = null;
      const av = row[20];
      if(av !== '' && av != null) { const n = parseInt(av,10); if(!isNaN(n)) anio = n; }
      const { pst, pos } = parsePSTposicion(wps);
      if(!pst) continue;
      nuevos.push({
        id: 'venc_' + pst + '_' + (pos||'NA') + '_' + nombre.replace(/[^A-Za-z0-9]/g,'').slice(0,20) + '_' + i,
        soldador: nombre, pst, posicion: pos, mes, anio, estado
      });
    }

    if(nuevos.length === 0) { alert('No se encontraron filas de vencimientos.'); setSyncStatus('idle'); return; }

    // Reemplazar la base de vencimientos con lo importado
    db.vencimientos = nuevos;
    saveDB();
    pushAllVencimientos();
    setSyncStatus('ok', 'Importado');
    setTimeout(()=>setSyncStatus('idle'), 2000);
    alert(`✓ Importados ${nuevos.length} registros de vencimiento.`);
    renderWPQ();
  } catch(e) {
    console.error('[importVencimientosExcel]', e);
    setSyncStatus('error', 'Error');
    alert('Error al leer el Excel: ' + e.message);
  }
}

// Calcula el estado de vencimiento de un registro ACTIVO respecto a hoy
// Devuelve: 'vencido' | 'porvencer' | 'vigente' | null (si no aplica)
function vencEstado(v) {
  if((v.estado||'').toUpperCase() !== 'ACTIVO') return null; // solo ACTIVO importa
  if(!v.mes || !v.anio) return null;
  const hoy = new Date();
  const mesHoy = hoy.getMonth() + 1, anioHoy = hoy.getFullYear();
  // vencido si el año/mes ya pasó completamente (antes del mes actual)
  if(v.anio < anioHoy || (v.anio === anioHoy && v.mes < mesHoy)) return 'vencido';
  // por vencer si vence este mes actual
  if(v.anio === anioHoy && v.mes === mesHoy) return 'porvencer';
  return 'vigente';
}

// Lista de vencidos y por vencer (solo ACTIVO)
function vencimientosResumen() {
  const vencidos = [], porvencer = [];
  (db.vencimientos||[]).forEach(v => {
    const e = vencEstado(v);
    if(e === 'vencido') vencidos.push(v);
    else if(e === 'porvencer') porvencer.push(v);
  });
  // Ordenar por PST (numérico), luego posición, luego soldador
  const pstKey = (v) => {
    const parts = String(v.pst||'').split('-').map(n => parseInt(n,10) || 0);
    return parts[0]*1000 + (parts[1]||0);
  };
  const ordena = (a,b) =>
    pstKey(a) - pstKey(b) ||
    String(a.posicion||'').localeCompare(String(b.posicion||'')) ||
    String(a.soldador||'').localeCompare(String(b.soldador||''));
  vencidos.sort(ordena); porvencer.sort(ordena);
  return { vencidos, porvencer };
}

// HTML del resumen fijo (sticky) de vencimientos
function vencimientosBannerHTML() {
  const { vencidos, porvencer } = vencimientosResumen();
  const fmtNombre = (s) => {
    return String(s||'').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };
  // Agrupa una lista por PST y devuelve HTML con un sub-bloque por PST
  const groupByPST = (lista, color, bg) => {
    const groups = {};
    lista.forEach(v => { (groups[v.pst] = groups[v.pst] || []).push(v); });
    const pstSort = (a,b) => {
      const pa = a.split('-').map(n=>parseInt(n,10)||0), pb = b.split('-').map(n=>parseInt(n,10)||0);
      return (pa[0]*1000+(pa[1]||0)) - (pb[0]*1000+(pb[1]||0));
    };
    return Object.keys(groups).sort(pstSort).map(pst => {
      const chips = groups[pst].map(v =>
        `<span style="display:inline-flex;align-items:center;font-size:11px;background:${bg};color:${color};border:1px solid ${color}33;padding:3px 9px;border-radius:12px;white-space:nowrap">
          ${esc(fmtNombre(v.soldador))}${v.posicion?(' · '+esc(v.posicion)):''}
        </span>`).join('');
      return `<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:5px">
        <span style="font-size:11px;font-weight:600;color:var(--text);min-width:64px;white-space:nowrap">PST ${esc(pst)}</span>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${chips}</div>
      </div>`;
    }).join('');
  };

  if(vencidos.length === 0 && porvencer.length === 0) {
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:10px 14px;font-size:12px;color:var(--text2);display:flex;align-items:center;gap:8px">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--green)"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      Sin vencimientos pendientes. Todas las calificaciones activas están vigentes.
    </div>`;
  }

  let html = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:11px 14px">`;
  if(vencidos.length) {
    html += `<div style="margin-bottom:${porvencer.length?'11px':'0'}">
      <div style="font-size:11px;font-weight:600;color:var(--red);text-transform:uppercase;letter-spacing:.04em;margin-bottom:7px;display:flex;align-items:center;gap:6px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--red)"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
        Vencidos (${vencidos.length})
      </div>
      ${groupByPST(vencidos,'var(--red)','var(--red-light)')}
    </div>`;
  }
  if(porvencer.length) {
    html += `<div>
      <div style="font-size:11px;font-weight:600;color:var(--amber);text-transform:uppercase;letter-spacing:.04em;margin-bottom:7px;display:flex;align-items:center;gap:6px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--amber)"><path d="M11 7h2v6h-2zm0 8h2v2h-2zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
        Por vencer este mes (${porvencer.length})
      </div>
      ${groupByPST(porvencer,'var(--amber)','var(--amber-light)')}
    </div>`;
  }
  html += `</div>`;
  return html;
}

// Revalidar desde la vista del soldador: maneja una o varias posiciones del PST
function revalidarSoldador(soldador, pst) {
  const regs = (db.vencimientos||[]).filter(v =>
    v.pst === pst && (v.soldador||'').toLowerCase() === (soldador||'').toLowerCase());

  let pos = '';
  if(regs.length > 1) {
    const opciones = regs.map((v,i) => `${i+1}. Posición ${v.posicion||'(sin pos)'}`).join('\n');
    const sel = prompt(`Este soldador tiene varias posiciones para el PST ${pst}.\n¿Cuál revalidás?\n\n${opciones}\n\nEscribí el número (o "todas"):`);
    if(sel === null) return;
    if(/^todas?$/i.test(sel.trim())) {
      // Revalidar todas con el mismo nuevo vencimiento
      const nuevo = prompt(`Nuevo vencimiento para TODAS las posiciones del PST ${pst} (MM/AAAA, ej: 06/2027):`);
      if(!nuevo) return;
      const m = nuevo.match(/(\d{1,2})\s*[\/\-]\s*(\d{4})/);
      if(!m) { alert('Formato inválido. Usá MM/AAAA.'); return; }
      const mes = parseInt(m[1],10), anio = parseInt(m[2],10);
      if(mes<1||mes>12){ alert('Mes inválido.'); return; }
      regs.forEach(v => { v.mes=mes; v.anio=anio; v.estado='ACTIVO'; pushVencimiento(v); });
      saveDB(); renderWPQ();
      alert('✓ Revalidadas todas las posiciones.');
      return;
    }
    const n = parseInt(sel.trim(),10);
    if(isNaN(n) || n<1 || n>regs.length) { alert('Opción inválida.'); return; }
    pos = regs[n-1].posicion || '';
  } else if(regs.length === 1) {
    pos = regs[0].posicion || '';
  }

  const ok = revalidarSoldadorPST(soldador, pst, pos);
  if(ok) { renderWPQ(); alert('✓ Revalidado.'); }
}

// Revalidar: actualiza el vencimiento de un soldador+PST a nuevo mes/año
function revalidarSoldadorPST(soldador, pst, pos) {
  const nuevo = prompt(`Revalidación de ${soldador} — PST ${pst}${pos?(' ('+pos+')'):''}\n\nIngresá el nuevo vencimiento como MM/AAAA (ej: 06/2027):`);
  if(!nuevo) return false;
  const m = nuevo.match(/(\d{1,2})\s*[\/\-]\s*(\d{4})/);
  if(!m) { alert('Formato inválido. Usá MM/AAAA, ej: 06/2027.'); return false; }
  const mes = parseInt(m[1],10), anio = parseInt(m[2],10);
  if(mes<1||mes>12) { alert('El mes debe estar entre 1 y 12.'); return false; }

  // Buscar registro existente
  let v = (db.vencimientos||[]).find(x =>
    x.pst === pst && (x.posicion||'') === (pos||'') &&
    (x.soldador||'').toLowerCase() === (soldador||'').toLowerCase());
  if(v) {
    v.mes = mes; v.anio = anio; v.estado = 'ACTIVO';
  } else {
    v = { id:'venc_'+pst+'_'+(pos||'NA')+'_'+soldador.replace(/[^A-Za-z0-9]/g,'').slice(0,20),
          soldador, pst, posicion: pos||'', mes, anio, estado:'ACTIVO' };
    if(!db.vencimientos) db.vencimientos = [];
    db.vencimientos.push(v);
  }
  pushVencimiento(v);
  saveDB();
  return true;
}
