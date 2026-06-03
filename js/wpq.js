// ════════════════════════════════════════════════════════════
// wpq.js — Calificaciones de soldadores (WPQ)
// Navegación tipo explorador: PST → soldadores → archivos
// ════════════════════════════════════════════════════════════

// Estado de navegación del explorador WPQ
let wpqNav = { level: 'pst', pst: null, soldador: null };

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

// Lista de PSTs únicos que tienen al menos un WPQ
function wpqAllPSTs() {
  const psts = {};
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
  return (db.wpq || []).filter(e => wpqNormPST(e.pst) === target);
}

// ── Vista principal (sidebar WPQ) ────────────────────────────

function showWPQView() {
  currentOT = null;
  currentTab = 'datos';
  document.querySelectorAll('.ot-item').forEach(el => el.classList.remove('active'));
  document.getElementById('sidebar-proc-wpq')?.classList.add('active');
  wpqNav = { level: 'pst', pst: null, soldador: null };
  renderWPQ();
}

function renderWPQ() {
  const titleEl = document.getElementById('topbar-title');
  const actionsEl = document.getElementById('topbar-actions');
  if(titleEl) titleEl.textContent = 'WPQ — Calificación de soldadores';

  if(wpqNav.level === 'pst') {
    if(actionsEl) actionsEl.innerHTML =
      `<button class="btn btn-primary btn-sm" onclick="openNewPSTModal()">+ Nueva carpeta WPS</button>`;
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
      <p>Creá una carpeta de WPS (por número PST) para empezar a cargar soldadores.</p>
    </div>`;
  } else {
    cards = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">` +
      keys.map(pst => {
        const count = psts[pst].length;
        return `<div class="wpq-folder" onclick="wpqOpenPST('${escAttr(pst)}')"
          style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 14px;text-align:center;cursor:pointer;transition:all .15s"
          onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="var(--accent)" style="margin:0 auto">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
          <div style="font-size:13px;font-weight:600;margin-top:8px">PST ${esc(pst)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${count} soldador${count===1?'':'es'}</div>
          <button onclick="event.stopPropagation();deletePSTFolder('${escAttr(pst)}')"
            style="margin-top:8px;font-size:10px;color:var(--red);background:none;border:none;cursor:pointer">eliminar</button>
        </div>`;
      }).join('') + `</div>`;
  }

  main.innerHTML = `<div class="fade-in">
    <div style="margin-bottom:16px;color:var(--text2);font-size:13px">
      Carpetas de WPS organizadas por número PST. Hacé click para ver los soldadores calificados.
    </div>
    ${cards}
  </div>`;
}

function wpqOpenPST(pst) {
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
        return `<div class="wpq-folder" onclick="wpqOpenSoldador('${escAttr(s.id)}')"
          style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 14px;text-align:center;cursor:pointer;transition:all .15s"
          onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="var(--text2)" style="margin:0 auto">
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
  wpqNav = { level: 'archivos', pst: wpqNav.pst, soldador: id };
  renderWPQ();
}

// ── NIVEL 3: archivos del soldador ───────────────────────────

function renderWPQarchivosLevel() {
  const entry = (db.wpq||[]).find(e => e.id === wpqNav.soldador);
  const main = document.getElementById('main-content');
  if(!entry) { wpqBack(); return; }

  const bc = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button class="btn btn-secondary btn-sm" onclick="wpqBack()">← Volver</button>
    <span style="font-size:13px;color:var(--text2)">WPQ / PST ${esc(entry.pst)} / <strong style="color:var(--text)">${esc(entry.soldador)}</strong></span>
  </div>`;

  let files = '';
  if((entry.files||[]).length === 0) {
    files = `<div style="color:var(--text3);font-size:13px;padding:20px">Este soldador no tiene archivos cargados.</div>`;
  } else {
    files = `<div style="display:flex;flex-direction:column;gap:6px">` +
      entry.files.map(f => `<div style="display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:10px 12px">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--accent)"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
          <span style="font-size:13px;flex:1">${esc(f.name)}</span>
          <button class="btn btn-secondary btn-sm" title="Ver" onclick="viewWPQFile('${escAttr(entry.id)}','${escAttr(f.id)}')" style="padding:4px 8px">👁</button>
          <button class="btn btn-secondary btn-sm" title="Descargar" onclick="downloadWPQFile('${escAttr(entry.id)}','${escAttr(f.id)}')" style="padding:4px 8px">⬇</button>
          <button class="btn btn-secondary btn-sm" title="Imprimir" onclick="printWPQFile('${escAttr(entry.id)}','${escAttr(f.id)}')" style="padding:4px 8px">🖨</button>
        </div>`).join('') + `</div>`;
  }

  main.innerHTML = `<div class="fade-in">${bc}${files}</div>`;
}

// ── Navegación: volver un nivel ──────────────────────────────

function wpqBack() {
  if(wpqNav.level === 'archivos') {
    wpqNav = { level: 'soldadores', pst: wpqNav.pst, soldador: null };
  } else if(wpqNav.level === 'soldadores') {
    wpqNav = { level: 'pst', pst: null, soldador: null };
  }
  renderWPQ();
}

// ── Crear carpeta de PST manualmente ─────────────────────────

function openNewPSTModal() {
  const pst = prompt('Número de PST para la nueva carpeta (ej: 14-08):');
  if(!pst) return;
  const clean = pst.trim();
  if(!clean) return;
  // Crear un registro placeholder vacío para que la carpeta exista
  // (se elimina sola si nunca se le carga un soldador y se recarga la página;
  //  para persistir, creamos una entrada vacía marcada)
  if(wpqAllPSTs()[clean]) { alert('Ya existe una carpeta para ese PST.'); wpqOpenPST(clean); return; }
  // Abrir directamente la carpeta (vacía) para cargar soldadores
  wpqOpenPST(clean);
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
  for(const file of fileList) {
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

  return `<div style="margin-top:10px;padding:10px 12px;background:var(--bg);border-radius:var(--r)">
    <div style="font-size:11px;color:var(--text2);margin-bottom:8px;display:flex;align-items:center;gap:6px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text2)"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
      Soldadores calificados para PST ${esc(pstNum)}
    </div>
    ${rows}
  </div>`;
}

// Helper de escape de atributos (por si no existe en utils)
function escAttr(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}
