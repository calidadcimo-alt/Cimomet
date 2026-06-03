// ════════════════════════════════════════════════════════════
// storage.js — Almacenamiento local (localStorage + IndexedDB)
// ════════════════════════════════════════════════════════════

function openIDB() {
  return new Promise((res, rej) => {
    if(idb) return res(idb);
    const req = indexedDB.open('cimomet_files', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('files', {keyPath: 'id'});
    };
    req.onsuccess = e => { idb = e.target.result; res(idb); };
    req.onerror = () => rej(req.error);
  });
}

async function idbSave(id, data, mimeType, filename) {
  const db2 = await openIDB();
  await new Promise((res, rej) => {
    const tx = db2.transaction('files', 'readwrite');
    tx.objectStore('files').put({id, data, mimeType, filename});
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  // Upload to cloud in background
  if(syncEnabled) supaUploadFile(id, data, mimeType, filename).catch(()=>{});
}

async function idbGet(id) {
  // Try local IDB first
  try {
    const db2 = await openIDB();
    const local = await new Promise((res, rej) => {
      const req = db2.transaction('files','readonly').objectStore('files').get(id);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    if(local) return local;
  } catch(e) {}
  // Fallback: download from cloud
  let proc = (db.procedures||[]).find(p=>p.id===id)
    || (db.ots||[]).flatMap(o=>(o.f07s||[])).find(f=>f.id===id);
  // También buscar en archivos de WPQ (calificaciones de soldadores)
  if(!proc) {
    for(const e of (db.wpq||[])) {
      const wf = (e.files||[]).find(f => f.id === id);
      if(wf) { proc = wf; break; }
    }
  }
  const filename = (proc && (proc.filename||proc.name)) || (id + '.pdf');
  const rec = await supaDownloadFile(id, filename);
  if(rec) {
    try { 
      const db3 = await openIDB();
      db3.transaction('files','readwrite').objectStore('files').put(rec);
    } catch(e) {}
    return rec;
  }
  return null;
}

async function idbDelete(id) {
  const db2 = await openIDB();
  return new Promise((res, rej) => {
    const tx = db2.transaction('files','readwrite');
    tx.objectStore('files').delete(id);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

function loadDB(){
  try{ const s=localStorage.getItem('cimomet_db'); if(s) db=JSON.parse(s); }catch(e){}
  if(!db.customLibrary) db.customLibrary=[];
  if(!db.procedures) db.procedures=[];
  if(!db.wpq) db.wpq=[];
  if(!db.vencimientos) db.vencimientos=[];
  // Strip any leftover file data from localStorage (migration)
  db.procedures.forEach(p => { delete p.data; });
  if(!db.customProcTypes) db.customProcTypes = [];
  // (migration removed)
  // Restore custom types into PROC_ITEM_MAP (supports both old string and new {name,keywords} format)
  db.customProcTypes.forEach(t => {
    const name = typeof t === 'string' ? t : t.name;
    const keywords = typeof t === 'object' && t.keywords
      ? t.keywords
      : [name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9 ]/g,'').trim()];
    PROC_ITEM_MAP[name] = keywords;
  });
}

function saveDB(){
  // Never save file data to localStorage
  const safe = JSON.parse(JSON.stringify(db));
  safe.procedures.forEach(p => { delete p.data; });
  try{ localStorage.setItem('cimomet_db', JSON.stringify(safe)); }catch(e){
    alert('Error al guardar configuración: ' + e.message);
  }
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
// Track which status groups are collapsed in sidebar
if(!window.sidebarCollapsed) window.sidebarCollapsed = {pending: true, done: true};

