// ════════════════════════════════════════════════════════════
// f07.js — Carga y procesamiento del Plan de Inspección F-07
// ════════════════════════════════════════════════════════════

// Normaliza texto: mayúsculas, sin acentos
function normTxt(s){
  return String(s||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

// Detecta el tipo de F-07 por palabras clave. Devuelve 'equipos' | 'estructuras' | null
function detectF07Tipo(textUp){
  const t = normTxt(textUp);
  // Señales de EQUIPOS (tanques, recipientes a presión)
  const equiposKW = ['ASME VIII','CONTROL DIMENSIONAL TKS','PRUEBA HIDRAULICA','PRUEBA DE ESTANQUEIDAD',
    'PRUEBA DE VACIO','CANCAMOS DE IZAJE','TANQUES','EQUIPO.','ENVOLVENTE','CABEZALES','CASQUETES'];
  // Señales de ESTRUCTURAS
  const estructKW = ['AWS D1.1','AWS D1-1','DIN 8570','CABRIADAS','CORREAS','COLUMNAS',
    'PARTICULAS MAGNETIZABLES','ALIVIO DE TENSIONES','A-572','A325','PERFILERIA','ESTRUCTURA'];
  let eq=0, es=0;
  equiposKW.forEach(k=>{ if(t.includes(normTxt(k))) eq++; });
  estructKW.forEach(k=>{ if(t.includes(normTxt(k))) es++; });
  if(eq===0 && es===0) return null;
  if(eq>0 && es>0)   return (eq>=es) ? 'equipos' : 'estructuras'; // dominante; "ambos" se arma al acumular
  return eq>es ? 'equipos' : 'estructuras';
}

// ¿Un ensayo aplica? Busca el nombre del ensayo en el texto y mira si lo que le sigue
// inmediatamente (en los próximos ~60 caracteres) es "N/A". Si es N/A → NO aplica.
// Si encuentra una norma (AWS/ASME/DIN/etc.) o cualquier otra cosa → SÍ aplica.
function ensayoAplica(textUp, nombresEnsayo){
  const t = normTxt(textUp);
  for(const nombre of nombresEnsayo){
    const n = normTxt(nombre);
    let idx = t.indexOf(n);
    while(idx !== -1){
      // Ventana de texto justo después del nombre del ensayo
      const after = t.slice(idx + n.length, idx + n.length + 70);
      // Si lo primero significativo es N/A → este ensayo no aplica (seguir buscando otra mención)
      const naMatch = after.match(/^[\s\S]{0,40}?\bN\s*\/?\s*A\b/);
      const normaMatch = after.match(/\b(AWS|ASME|DIN|ASTM|ISO|API)\b/);
      if(normaMatch && (!naMatch || normaMatch.index < naMatch.index)){
        return true; // hay una norma antes que un N/A → aplica
      }
      if(!naMatch){
        return true; // no hay N/A cerca → asumimos que aplica
      }
      idx = t.indexOf(n, idx + n.length);
    }
  }
  return false; // todas las menciones tenían N/A inmediato → no aplica
}

// Ensayos sujetos a verificación de N/A, con sus nombres tal como aparecen en el F-07
const ENSAYO_NA_CHECK = {
  "INFORMES DE LIQUIDOS PENETRANTES": ["LIQUIDOS PENETRANTES"],
  "INFORME DE GAMMAGRAFIA":           ["ENSAYO DE RADIOGRAFIA","RADIOGRAFIADO","GAMMAGRAFIA"],
  "INFORME DE ULTRASONIDO":           ["ULTRASONIDO"],
};

function renderTabF07(ot,el){
  const f07sHTML = ot.f07s && ot.f07s.length ? ot.f07s.map((f,i)=>`
    <div class="f07-card">
      <div class="f07-icon">📋</div>
      <div style="flex:1;min-width:0">
        <div class="f07-name">${esc(f.name)}</div>
        <div class="f07-meta">Cargado ${f.date} · ${f.items||0} ítems detectados</div>
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0">
        ${f.id ? `<button class="btn btn-secondary btn-sm" title="Abrir" onclick="openF07('${f.id}','${esc(f.name)}')"
          style="padding:4px 8px">
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
          </svg>
        </button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="removeF07(${i})" style="padding:4px 8px">✕</button>
      </div>
    </div>`).join('') : '<div style="font-size:13px;color:var(--text3);padding:8px 0">Sin F-07 cargados todavía.</div>';

  el.innerHTML=`
    <div class="card">
      <div class="card-header">
        <span class="card-title">Plan de Inspección F-07</span>
        <span class="chip">${ot.f07s?ot.f07s.length:0} archivo/s</span>
      </div>
      <p style="font-size:13px;color:var(--text3);margin-bottom:14px">
        Al cargar el F-07 se detectan automáticamente los ítems del databook y se completan los datos del proyecto.
      </p>
      <div class="dropzone" id="dz-f07" onclick="document.getElementById('f07-file').click()"
        ondragover="dzOver(event,'dz-f07')" ondragleave="dzLeave('dz-f07')" ondrop="dzDrop(event)">
        <div class="dz-icon">📂</div>
        <div class="dz-text">Arrastrá el F-07 acá o hacé click<br><small style="color:#C5C0B8">.doc o .docx</small></div>
      </div>
      <input type="file" id="f07-file" accept=".doc,.docx" style="display:none" onchange="loadF07file(this.files[0])">
      <div class="status-msg" id="f07-status" style="margin-top:8px"></div>
      <hr>
      <div class="card-title" style="margin-bottom:10px">Archivos cargados</div>
      <div class="f07-list">${f07sHTML}</div>
    </div>`;
}

function dzOver(e,id){e.preventDefault();document.getElementById(id).classList.add('over')}

function dzLeave(id){document.getElementById(id).classList.remove('over')}

function dzDrop(e){
  e.preventDefault();dzLeave('dz-f07');
  const f=e.dataTransfer.files[0];if(f)loadF07file(f);
}

async function loadF07file(file){
  if(!file) return;
  const statusEl=document.getElementById('f07-status');
  if(statusEl) statusEl.textContent='Leyendo F-07...';
  try{
    const arrayBuffer=await file.arrayBuffer();
    const bytes=new Uint8Array(arrayBuffer);
    const isDoc=file.name.toLowerCase().endsWith('.doc')&&!file.name.toLowerCase().endsWith('.docx');
    // Check OLE magic bytes: D0 CF 11 E0
    const isOLE=bytes[0]===0xD0&&bytes[1]===0xCF&&bytes[2]===0x11&&bytes[3]===0xE0;
    let text='';

    if(isDoc||isOLE){
      // .doc (OLE binary): extract ASCII and UTF-16LE text runs
      // ASCII runs
      let run=[];
      for(let i=0;i<bytes.length;i++){
        const b=bytes[i];
        if(b>=32&&b<=126){ run.push(String.fromCharCode(b)); }
        else{ if(run.length>=5) text+=run.join('')+' '; run=[]; }
      }
      if(run.length>=5) text+=run.join('');
      // UTF-16LE runs (Word stores text in UTF-16)
      try{
        const u16=new Uint16Array(arrayBuffer);
        let urun=[];
        for(let i=0;i<u16.length;i++){
          const c=u16[i];
          if((c>=32&&c<=126)||(c>=160&&c<=255)){
            urun.push(String.fromCharCode(c));
          } else {
            if(urun.length>=5) text+=' '+urun.join('');
            urun=[];
          }
        }
        if(urun.length>=5) text+=' '+urun.join('');
      }catch(e){}
    } else {
      // .docx (ZIP): use JSZip
      const zip=await JSZip.loadAsync(arrayBuffer);
      const xmlFiles=['word/document.xml','word/header1.xml','word/footer1.xml'];
      for(const fname of xmlFiles){
        const f=zip.file(fname);
        if(f){
          const xml=await f.async('string');
          const re=/<w:t[^>]*>([^<]*)<\/w:t>/g;
          let m;
          while((m=re.exec(xml))!==null) text+=m[1]+' ';
        }
      }
    }

    if(!text.trim()){
      if(statusEl) statusEl.textContent='⚠️ No se pudo leer el contenido del archivo.';
      return;
    }
    window._lastF07ArrayBuffer = arrayBuffer;
    processF07(text,file.name);
  }catch(err){
    if(statusEl) statusEl.textContent='Error al leer el archivo: '+err.message;
    console.error(err);
  }
}

function processF07(text,filename){
  const ot=db.ots.find(o=>o.id===currentOT);
  if(!ot) return;

  // Extract header data from F-07 — always overwrite with F-07 values
  let m;

  // OT number — look for OT N°: XX or similar
  m=text.match(/OT[.\s]*N[°º][\s.:]*([\w\d]+)/i);
  if(m) ot.num=m[1].replace(/[^\w\d]/g,'');

  // Cliente — appears after "CLIENTE:" label
  // The F-07 header has: CLIENTE: TERNIUM  (or similar)
  m=text.match(/CLIENTE[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s.&]{1,30}?)(?=\s{2,}|\bOT\b|\bOBRA\b|\bPLANO\b|\bEQUIPO\b|\bHOJA\b|\bOFERTA\b|\b\d)/i);
  if(m) ot.cliente=m[1].trim().replace(/\.$/,'').toUpperCase();

  // Equipo / Obra — appears right after "EQUIPO: N°" label in F-07 header
  m=text.match(/EQUIPO[:\s]+N[°º]\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?=\s+(?:\d[A-Za-z]|[A-Z]{2,}\d|\d{3,}|Plano|OFERTA|CIMOMET|N°))/i);
  if(!m) m=text.match(/EQUIPO[:\s]+(?:N[°º][\s\d]*)([A-ZÁÉÍÓÚÑ][^\n]{3,60?})(?=\s+(?:Plano|OFERTA|OT|CLIENTE|HOJA))/i);
  if(m) ot.obra=m[1].trim().replace(/\s+/g,' ').toUpperCase();

  // Plano
  m=text.match(/[Pp]lano[:\s]+(?:N[°º][\s]*)?([\w\d][\w\d\-\.]+)/i);
  if(m) ot.plano=m[1].trim();

  // Año — extract from 4-digit years OR 2-digit dates like 10/03/26
  const years4=text.match(/\b(20\d{2})\b/g)||[];
  const years2=(text.match(/\d{1,2}[\/-]\d{1,2}[\/-](\d{2})\b/g)||[])
    .map(d=>{ const y=d.split(/[\/\-]/).pop(); return y.length===2?'20'+y:y; });
  const allYears=[...years4,...years2].filter(y=>y>='2020'&&y<='2035');
  if(allYears.length) ot.anio=allYears.sort().pop();

  // OFerta técnica (número de oferta — útil para referencia)
  m=text.match(/OFERTA\s+TECNICA[\s\S]{0,20}?N[°º][\s]*(\d+[-\/\d]*)/i);
  if(m && !ot.oferta) ot.oferta=m[1].trim();

  // Auto-detect standard items
  const textUp=text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  // ── Detección de TIPO de F-07 (equipos / estructuras) ──────────
  const tipoDetectado = detectF07Tipo(textUp);
  // Acumular en ot.tipo: si ya tenía otro tipo y ahora carga el opuesto → "ambos"
  if(tipoDetectado){
    if(!ot.tipo || ot.tipo===tipoDetectado) ot.tipo = tipoDetectado;
    else ot.tipo = 'ambos';
  }

  // ── Detección de ítems con filtro N/A ──────────────────────────
  // Un ensayo END solo se agrega si en el F-07 aparece CON una norma aplicable (no "N/A")
  const detectedItems=ALL_ITEMS.filter(item=>{
    const kws=ITEM_KW[item];
    if(!kws) return true;
    // ¿El ítem aparece mencionado?
    const aparece = kws.some(kw=>textUp.includes(normTxt(kw)));
    if(!aparece) return false;
    // Si es un ensayo sujeto a N/A, verificar que NO esté marcado como N/A
    if(item in ENSAYO_NA_CHECK){
      return ensayoAplica(textUp, ENSAYO_NA_CHECK[item]);
    }
    return true;
  });
  // Always pre-select default items even if not in F-07
  const allDetected = [...new Set([...DEFAULT_ITEMS, ...detectedItems])];
  ot.items=allDetected;
  sortItems(ot);  // ensure canonical order

  // Auto-detect custom items: scan for PRUEBA/ENSAYO/TEST patterns not covered by standard items
  const extraPatterns=[
    /\b\d{1,2}\s+(PRUEBA\s+[A-Z]+(?:\s+[A-Z]+)?)/g,
    /\b\d{1,2}\s+(ENSAYO\s+[A-Z]+(?:\s+[A-Z]+)?)/g,
    /\b\d{1,2}\s+(TEST\s+[A-Z]+(?:\s+[A-Z]+)?)/g,
    /\b\d{1,2}\s+(VERIFICACION\s+[A-Z]+(?:\s+[A-Z]+)?)/g,
  ];
  const newCustomItems=new Set();
  for(const pat of extraPatterns){
    let em;
    while((em=pat.exec(textUp))!==null){
      const candidate=em[1].trim().replace(/\s+/g,' ');
      // Check not already covered by standard item keywords
      const alreadyCovered=Object.values(ITEM_KW).some(kws=>
        kws.some(kw=>candidate.includes(kw.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')))
      );
      if(!alreadyCovered) newCustomItems.add('INFORME DE '+candidate);
    }
  }
  if(newCustomItems.size>0){
    if(!ot.customItems) ot.customItems=[];
    for(const item of newCustomItems){
      if(!ot.customItems.includes(item)){
        ot.customItems.push(item);
        // Also add to library
        if(!db.customLibrary) db.customLibrary=[];
        if(!db.customLibrary.includes(item)) db.customLibrary.push(item);
      }
    }
  }

  // Save F07 reference and raw text for PST matching
  if(!ot.f07s) ot.f07s=[];
  const f07id = 'f07_' + ot.id + '_' + Date.now();
  ot.f07s.push({
    id: f07id,
    name:filename,
    date:new Date().toLocaleDateString('es-AR'),
    items:detectedItems.length
  });
  // Store normalized F-07 text for PST number matching
  ot.f07text = text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  // Save file to IndexedDB for later viewing
  if(window._lastF07ArrayBuffer){
    const bytes = new Uint8Array(window._lastF07ArrayBuffer);
    let b64=''; const CHUNK=8192;
    for(let i=0;i<bytes.length;i+=CHUNK) b64+=String.fromCharCode(...bytes.subarray(i,i+CHUNK));
    b64=btoa(b64);
    const mime = filename.toLowerCase().endsWith('.pdf') ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    idbSave(f07id, b64, mime, filename).catch(e=>console.warn('F07 save:',e));
    window._lastF07ArrayBuffer = null;
  }

  saveDB();
  // Update the data fields in the UI if currently on datos tab
  ['ot','cliente','obra','plano','anio'].forEach(field=>{
    const el=document.getElementById('d-'+field);
    if(el) el.value=ot[field]||'';
  });
  const statusEl=document.getElementById('f07-status');
  if(statusEl) statusEl.textContent=`✅ ${detectedItems.length} estándar` + ((ot.customItems||[]).length>0?` + ${(ot.customItems||[]).length} adicionales`:'') + ` detectados.`;
  // Refresh sidebar, show datos tab first so user sees the loaded fields
  renderSidebar();
  setTimeout(()=>{
    switchTab('datos');   // show filled data fields
    // Brief flash on items tab label to hint it was also updated
    setTimeout(()=>{
      const itemsTab=document.querySelector('.tab:nth-child(3)');
      if(itemsTab){
        itemsTab.style.color='var(--accent)';
        itemsTab.style.fontWeight='600';
        setTimeout(()=>{itemsTab.style.color='';itemsTab.style.fontWeight='';},2000);
      }
    },300);
  },400);
}

function removeF07(idx){
  const ot=db.ots.find(o=>o.id===currentOT);
  if(!ot||!ot.f07s) return;
  const f07 = ot.f07s[idx];
  if(f07 && f07.id) idbDelete(f07.id).catch(()=>{});
  ot.f07s.splice(idx,1);
  saveDB(); renderTab();
}

// ── Tab: Items ───────────────────────────────────────────────────────────────

async function openF07(id, filename) {
  try {
    const record = await idbGet(id);
    if(!record) { alert('Archivo no encontrado. Volvé a cargar el F-07.'); return; }
    const bytes = Uint8Array.from(atob(record.data), c => c.charCodeAt(0));
    const mime = record.mimeType || 'application/octet-stream';
    const blob = new Blob([bytes], {type: mime});
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch(e) { alert('Error al abrir: ' + e.message); }
}

function extractPSTFromFilename(filename) {
  // Extract PST number from filename, e.g. "PST-14-08.pdf" → "14-08"
  const name = filename.replace(/\.[^.]+$/, '');
  // Try: PST[separator]NUM[sep]NUM — handles PST-14-08, PST N°14/08, PST Nro 14-08, etc.
  let m = name.match(/PST[\s\-_Nnoº°#rRoO]*(\d{1,2})[\-\/\.\s_](\d{2,4})/i);
  if(m) return m[1] + '-' + m[2];
  // Fallback: PST followed by 4 digits (e.g. PST1408)
  m = name.match(/PST[\s\-_]*(\d{4})/i);
  if(m) return m[1].slice(0,2) + '-' + m[1].slice(2);
  // Last resort: any digits after PST
  m = name.match(/PST[\s\-_]*(\d{2,4})/i);
  if(m) return m[1];
  return null;
}

function extractPSTsFromText(text) {
  // Extract all PST numbers from F-07 text, e.g. "PST Nº 14/08", "PST N  14/08"
  const psts = new Set();
  const re = /PST[\s\-_Nnoº°#rRoO]*(\d{1,2})[\-\/\.\s](\d{2,4})/gi;
  let m;
  while((m = re.exec(text)) !== null) {
    psts.add(m[1] + '-' + m[2]);
  }
  return psts;
}

function normPST(s) {
  // Normalize PST number: "14-08" and "14/08" both become "14-8"
  return s.split(/[-\/]/).map(p => String(parseInt(p,10))).join('-');
}

