// ════════════════════════════════════════════════════════════
// sync.js — Sincronización con Supabase (nube)
// ════════════════════════════════════════════════════════════

function supaHeaders(extra) {
  return Object.assign({
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type': 'application/json'
  }, extra||{});
}

function setSyncStatus(state, msg) {
  const el = document.getElementById('sync-status');
  if(!el) return;
  const cfg = {
    idle:    {icon:'', color:'var(--text3)'},
    syncing: {icon:'⟳', color:'var(--amber)'},
    ok:      {icon:'✓', color:'var(--green)'},
    error:   {icon:'⚠', color:'var(--red)'}
  }[state] || {icon:'', color:'var(--text3)'};
  el.textContent = (cfg.icon ? cfg.icon + ' ' : '') + (msg||'');
  el.style.color = cfg.color;
}

// Push entire db to cloud (debounced)

async function pushOT(ot) {
  if(!syncEnabled || !ot) return;
  try {
    const row = {
      id: ot.id, num: ot.num, cliente: ot.cliente, obra: ot.obra||'',
      plano: ot.plano||'', anio: ot.anio||'', estado: ot.estado||'active',
      items: ot.items||null, custom_items: ot.customItems||[],
      manual_procs: ot.manualProcs||[], excluded_procs: ot.excludedProcs||[],
      f07s: ot.f07s||[], f07text: ot.f07text||'',
      created_at: ot.createdAt ? new Date(ot.createdAt).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const r = await fetch(SUPA_URL + '/rest/v1/ots?on_conflict=id', {
      method:'POST', headers: supaHeaders({'Prefer':'resolution=merge-duplicates,return=minimal'}),
      body: JSON.stringify(row)
    });
    if(!r.ok) console.error('[pushOT]', r.status, await r.text());
  } catch(e) { console.error('[pushOT]', e); }
}

// Map procedure category → Supabase table name

function procTableFor(type) {
  const cat = (typeof procCategory==='function') ? procCategory(type) : '';
  if(cat === 'Procedimiento de Soldadura (WPS/PQR)') return 'procedures_wps';
  if(cat === 'Procedimiento de Pintura / Tratamiento Superficial') return 'procedures_sup';
  return 'procedures_end';
}

// Push a single procedure to its category table

async function pushProc(p) {
  if(!syncEnabled || !p) return;
  try {
    const table = procTableFor(p.type);
    const row = {
      id: p.id, name: p.name, type: p.type, file_type: p.fileType||'',
      filename: p.filename||'', date: p.date||'', mime_type: p.mimeType||'',
      updated_at: new Date().toISOString()
    };
    const r = await fetch(SUPA_URL + '/rest/v1/' + table + '?on_conflict=id', {
      method:'POST', headers: supaHeaders({'Prefer':'resolution=merge-duplicates,return=minimal'}),
      body: JSON.stringify(row)
    });
    if(!r.ok) console.error('[pushProc]', table, r.status, await r.text());
  } catch(e) { console.error('[pushProc]', e); }
}

// Delete a procedure from its category table

async function deleteProcFromCloud(p) {
  if(!syncEnabled || !p) return;
  try {
    const table = procTableFor(p.type);
    await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + p.id, {method:'DELETE', headers: supaHeaders()});
  } catch(e) {}
}

// Push library (custom items + custom types) immediately

async function pushLibrary() {
  if(!syncEnabled) return;
  try {
    const libData = { customLibrary: db.customLibrary||[], customProcTypes: db.customProcTypes||[] };
    await fetch(SUPA_URL + '/rest/v1/library?on_conflict=id', {
      method:'POST', headers: supaHeaders({'Prefer':'resolution=merge-duplicates,return=minimal'}),
      body: JSON.stringify({id:'main', data: libData, updated_at: new Date().toISOString()})
    });
  } catch(e) { console.error('[pushLibrary]', e); }
}
let syncTimeout = null;
let syncEnabled = true;

function syncToCloud(delay) {
  console.log('[SYNC] syncToCloud called, enabled:', syncEnabled);
  if(!syncEnabled) return;
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    setSyncStatus('syncing','Guardando…');
    try {
      // Upsert all OTs (one row each)
      const otRows = (db.ots||[]).map(ot => ({
        id: ot.id, num: ot.num, cliente: ot.cliente, obra: ot.obra||'',
        plano: ot.plano||'', anio: ot.anio||'', estado: ot.estado||'active',
        items: ot.items||null, custom_items: ot.customItems||[],
        manual_procs: ot.manualProcs||[], excluded_procs: ot.excludedProcs||[],
        f07s: ot.f07s||[], f07text: ot.f07text||'',
        created_at: ot.createdAt ? new Date(ot.createdAt).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      if(otRows.length) {
        const r = await fetch(SUPA_URL + '/rest/v1/ots?on_conflict=id', {
          method:'POST', headers: supaHeaders({'Prefer':'resolution=merge-duplicates,return=minimal'}),
          body: JSON.stringify(otRows)
        });
        if(!r.ok) throw new Error('ots ' + r.status + ': ' + (await r.text()).slice(0,80));
      }
      // Upsert procedures grouped by category table
      const byTable = {procedures_end:[], procedures_sup:[], procedures_wps:[]};
      (db.procedures||[]).forEach(p => {
        const t = procTableFor(p.type);
        byTable[t].push({
          id: p.id, name: p.name, type: p.type, file_type: p.fileType||'',
          filename: p.filename||'', date: p.date||'', mime_type: p.mimeType||'',
          updated_at: new Date().toISOString()
        });
      });
      for(const [table, rows] of Object.entries(byTable)) {
        if(!rows.length) continue;
        const r = await fetch(SUPA_URL + '/rest/v1/' + table + '?on_conflict=id', {
          method:'POST', headers: supaHeaders({'Prefer':'resolution=merge-duplicates,return=minimal'}),
          body: JSON.stringify(rows)
        });
        if(!r.ok) throw new Error(table + ' ' + r.status + ': ' + (await r.text()).slice(0,80));
      }
      // Upsert library (custom items + custom proc types) as single row
      const libData = {
        customLibrary: db.customLibrary||[],
        customProcTypes: db.customProcTypes||[]
      };
      const rl = await fetch(SUPA_URL + '/rest/v1/library?on_conflict=id', {
        method:'POST', headers: supaHeaders({'Prefer':'resolution=merge-duplicates,return=minimal'}),
        body: JSON.stringify({id:'main', data: libData, updated_at: new Date().toISOString()})
      });
      if(!rl.ok) throw new Error('library ' + rl.status + ': ' + (await rl.text()).slice(0,80));

      setSyncStatus('ok','Guardado');
      setTimeout(() => setSyncStatus('idle'), 2500);
    } catch(e) {
      console.error('[SYNC ERROR]', e.message, e);
      setSyncStatus('error', e.message.slice(0,30));
    }
  }, delay==null ? 1200 : delay);
}

// Pull entire db from cloud

async function syncFromCloud() {
  setSyncStatus('syncing','Sincronizando…');
  try {
    const _wasInitial = !initialSyncDone;
    // Fetch OTs
    const rOts = await fetch(SUPA_URL + '/rest/v1/ots?select=*', {headers: supaHeaders()});
    if(!rOts.ok) throw new Error('ots HTTP ' + rOts.status);
    const otRows = await rOts.json();

    // Fetch procedures from all 3 category tables
    let procRows = [];
    for(const table of ['procedures_end','procedures_sup','procedures_wps']) {
      const rp = await fetch(SUPA_URL + '/rest/v1/' + table + '?select=*', {headers: supaHeaders()});
      if(rp.ok) procRows = procRows.concat(await rp.json());
    }

    // Fetch WPQ (calificaciones de soldadores)
    let wpqRows = [];
    try {
      const rw = await fetch(SUPA_URL + '/rest/v1/wpq?select=*', {headers: supaHeaders()});
      if(rw.ok) wpqRows = await rw.json();
    } catch(e) {}

    // Fetch library
    const rLib = await fetch(SUPA_URL + '/rest/v1/library?id=eq.main&select=data', {headers: supaHeaders()});   const libRows = rLib.ok ? await rLib.json() : [];

    const cloudHasData = otRows.length > 0;
    const localEmpty = !db.ots || db.ots.length === 0;

    if(cloudHasData || localEmpty) {
      // Rebuild db from cloud tables
      db.ots = otRows.map(r => ({
        id: r.id, num: r.num, cliente: r.cliente, obra: r.obra,
        plano: r.plano, anio: r.anio, estado: r.estado,
        items: r.items, customItems: r.custom_items||[],
        manualProcs: r.manual_procs||[], excludedProcs: r.excluded_procs||[],
        f07s: r.f07s||[], f07text: r.f07text||'',
        createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now()
      }));
      db.procedures = procRows.map(r => ({
        id: r.id, name: r.name, type: r.type, fileType: r.file_type,
        filename: r.filename, date: r.date, mimeType: r.mime_type
      }));
      db.wpq = wpqRows.map(r => ({
        id: r.id, pst: r.pst, soldador: r.soldador, files: r.files || []
      }));
      if(libRows.length && libRows[0].data) {
        db.customLibrary = libRows[0].data.customLibrary || [];
        db.customProcTypes = libRows[0].data.customProcTypes || [];
      } else {
        if(!db.customLibrary) db.customLibrary = [];
        if(!db.customProcTypes) db.customProcTypes = [];
      }
      // Restore custom proc types into PROC_ITEM_MAP
      (db.customProcTypes||[]).forEach(t => {
        const name = typeof t==='string' ? t : t.name;
        const kws = (typeof t==='object' && t.keywords) ? t.keywords
          : [name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9 ]/g,'').trim()];
        if(typeof PROC_ITEM_MAP !== 'undefined') PROC_ITEM_MAP[name] = kws;
      });
      try{ localStorage.setItem('cimomet_db', JSON.stringify(db)); }catch(e){}
    }
    initialSyncDone = true;
    setSyncStatus('ok','Sincronizado');
    setTimeout(() => setSyncStatus('idle'), 2500);
    return true;
  } catch(e) {
    console.warn('Sync from cloud failed:', e);
    initialSyncDone = true; // allow editing even if cloud unreachable
    setSyncStatus('error','Sin conexión');
    return false;
  }
}

// Upload a file blob to Supabase Storage

async function supaUploadFile(id, b64, mimeType, filename) {
  try {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], {type: mimeType});
    const ext = (filename||'file').split('.').pop();
    const path = id + '.' + ext;
    const r = await fetch(SUPA_URL + '/storage/v1/object/files/' + path, {
      method: 'POST',
      headers: {'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Content-Type':mimeType,'x-upsert':'true'},
      body: blob
    });
    return r.ok ? path : null;
  } catch(e) { return null; }
}

// Download a file from Supabase Storage → returns base64 record or null

async function supaDownloadFile(id, filename) {
  try {
    const ext = (filename||'file').split('.').pop();
    const path = id + '.' + ext;
    const r = await fetch(SUPA_URL + '/storage/v1/object/files/' + path, {
      headers: {'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}
    });
    if(!r.ok) return null;
    const blob = await r.blob();
    const ab = await blob.arrayBuffer();
    const bytes = new Uint8Array(ab);
    let b64=''; const CHUNK=8192;
    for(let i=0;i<bytes.length;i+=CHUNK) b64+=String.fromCharCode.apply(null, bytes.subarray(i,i+CHUNK));
    b64 = btoa(b64);
    return {id, data:b64, mimeType: blob.type||'application/octet-stream', filename};
  } catch(e) { return null; }
}

let currentOT = null;
let currentTab = 'datos';

const ALL_ITEMS = [
  "PLAN DE INSPECCION Y ENSAYOS",       // 0
  "CERTIFICADOS DE MATERIALES",          // 1
  "WPS Y PQR","WPQ",                     // 2,3
  "PROCEDIMIENTOS DE END",               // 4  ← procedimiento END
  "PROCEDIMIENTO DE TRATAMIENTO SUPERFICIAL", // 5  ← procedimiento sup (si aplica)
  "PROTOCOLO DE CONTROL DIMENSIONAL",   // 6  ← informes END
  "INFORMES DE LIQUIDOS PENETRANTES",   // 7
  "INFORME DE GAMMAGRAFIA",             // 8
  "INFORME DE ULTRASONIDO",             // 9
  "INFORME DE TRATAMIENTO SUPERFICIAL", // 10 ← informe sup
  "ACTAS DE INSPECCIÓN",                // 11
  "ACTAS DE LIBERACION"                 // 12
];
// Custom items (pruebas, etc.) inserted between pos 9 and 10 by sortItems

// Custom items are inserted after this standard item
const CUSTOM_INSERT_AFTER = "INFORME DE ULTRASONIDO";

// Items pre-selected by default in every new OT (can be deselected)
const DEFAULT_ITEMS = [
  "PLAN DE INSPECCION Y ENSAYOS",
  "WPQ",
  "ACTAS DE INSPECCIÓN",
  "ACTAS DE LIBERACION"
];

const ITEM_KW = {
  "PLAN DE INSPECCION Y ENSAYOS":       ["PLAN DE INSPECCION"],
  "CERTIFICADOS DE MATERIALES":          ["CERTIFICADO","MILL CERT","CHAPAS","CANOS","PLANCHUELAS"],
  "WPS Y PQR":                           ["PROC SOLD","PST","PROCEDIMIENTO DE SOLDADURA"],
  "WPQ":                                 ["WPQ","CALIFICACION DE SOLDADOR"],
  "PROCEDIMIENTOS DE END":               ["LIQUIDOS PENETRANTE","RADIOGRAFI","ULTRASONIDO","GAMMAGRAF","END"],
  "PROCEDIMIENTO DE TRATAMIENTO SUPERFICIAL": ["PINTURA","PAINT","GRANALLADO","SHOT BLAST","GALVANIZADO","DECAPADO","PASIVADO"],
  "PROTOCOLO DE CONTROL DIMENSIONAL":   ["DIMENSIONAL","ISO 13920"],
  "INFORMES DE LIQUIDOS PENETRANTES":   ["LIQUIDOS PENETRANTE","LP "],
  "INFORME DE GAMMAGRAFIA":             ["RADIOGRAFI","GAMMAGRAF","ASME VIII","RADIOGRAFIADO"],
  "INFORME DE ULTRASONIDO":             ["ULTRASONIDO"],
  "INFORME DE TRATAMIENTO SUPERFICIAL": ["DECAPADO","PASIVADO","TRATAMIENTO SUPERFICIAL","PINTURA"],
  "ACTAS DE INSPECCIÓN":                ["INSPECCION","INSPECTOR"],
  "ACTAS DE LIBERACION":                ["LIBERACION","DESPACHO"]
};

const STATUS_LABELS = {active:'En proceso',pending:'Pendiente',done:'Terminada'};
const STATUS_BADGE  = {active:'badge-active',pending:'badge-pending',done:'badge-done'};
const STATUS_DOT    = {active:'dot-active',pending:'dot-pending',done:'dot-done'};

// ── Persistence ──────────────────────────────────────────────────────────────
// ── IndexedDB for procedure files ────────────────────────────────────────────
let idb = null;

