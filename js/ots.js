// ════════════════════════════════════════════════════════════
// ots.js — Órdenes de Trabajo (sidebar, CRUD, datos)
// ════════════════════════════════════════════════════════════

// renderSidebar() ahora vive en nav.js (navegación por pantallas)
function toggleSidebarGroup(key) {
  window.sidebarCollapsed[key] = !window.sidebarCollapsed[key];
  renderSidebar();
}

// ── OT CRUD ──────────────────────────────────────────────────────────────────

function openNewOTModal(){
  ['new-ot','new-cliente','new-obra','new-plano'].forEach(id=>{
    document.getElementById(id).value='';
  });
  // Reset dropzone
  document.getElementById('new-ot-dz').className='dropzone';
  document.getElementById('new-ot-dz-icon').textContent='📄';
  document.getElementById('new-ot-dz-text').innerHTML='Arrastrá el <strong>F-07</strong> acá para autocompletar<br><small style="color:#C5C0B8">o hacé click para seleccionar (.doc / .docx)</small>';
  document.getElementById('modal-new-ot').style.display='flex';
  // Don't auto-focus OT field — user may drop file first
}

async function newOTloadF07(file){
  if(!file) return;
  const dz=document.getElementById('new-ot-dz');
  const dzIcon=document.getElementById('new-ot-dz-icon');
  const dzText=document.getElementById('new-ot-dz-text');
  dzIcon.textContent='⏳';
  dzText.innerHTML='Leyendo <strong>'+file.name+'</strong>...';
  try{
    const arrayBuffer=await file.arrayBuffer();
    const bytes2=new Uint8Array(arrayBuffer);
    const isOLE2=bytes2[0]===0xD0&&bytes2[1]===0xCF&&bytes2[2]===0x11&&bytes2[3]===0xE0;
    let text='';
    if(isOLE2||file.name.toLowerCase().endsWith('.doc')&&!file.name.toLowerCase().endsWith('.docx')){
      let run2=[];
      for(let i=0;i<bytes2.length;i++){
        const b=bytes2[i];
        if(b>=32&&b<=126){run2.push(String.fromCharCode(b));}
        else{if(run2.length>=5)text+=run2.join('')+' ';run2=[];}
      }
      try{
        const u16b=new Uint16Array(arrayBuffer);
        let ur=[];
        for(let i=0;i<u16b.length;i++){
          const c=u16b[i];
          if((c>=32&&c<=126)||(c>=160&&c<=255)){ur.push(String.fromCharCode(c));}
          else{if(ur.length>=5)text+=' '+ur.join('');ur=[];}
        }
      }catch(e){}
    } else {
      const zip=await JSZip.loadAsync(arrayBuffer);
      for(const fname of ['word/document.xml','word/header1.xml','word/footer1.xml']){
        const f=zip.file(fname);
        if(f){
          const xml=await f.async('string');
          const re=/<w:t[^>]*>([^<]*)<\/w:t>/g;
          let m;while((m=re.exec(xml))!==null) text+=m[1]+' ';
        }
      }
    }
    // Extract fields and fill form
    let m;
    m=text.match(/OT\b[\s]*(?:N[°º])?[\s]*(\d+)/i);
    if(m) document.getElementById('new-ot').value=m[1];

    m=text.match(/CLIENTE[:\s]+([A-Z][A-Za-z\s.&]{1,30}?)(?=\s{2,}|\bOT\b|\bOBRA\b|\bPLANO\b|\bEQUIPO\b|\d)/i);
    if(m) document.getElementById('new-cliente').value=m[1].trim().replace(/\.$/,'').toUpperCase();

    m=text.match(/EQUIPO[:\s]+N[°º]\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?=\s+(?:\d[A-Za-z]|[A-Z]{2,}\d|\d{3,}|Plano|OFERTA|CIMOMET|N°))/i);
    if(!m) m=text.match(/EQUIPO[:\s]+(?:N[°º][\s\d]*)([A-ZÁÉÍÓÚÑ][^\n]{3,60?})(?=\s+(?:Plano|OFERTA|OT|CLIENTE|HOJA))/i);
    if(m) document.getElementById('new-obra').value=m[1].trim().replace(/\s+/g,' ').toUpperCase();

    m=text.match(/[Pp]lano[:\s]+N[°º]\s*([\w\d][\w\d\-\.]+)/i);
    if(m) document.getElementById('new-plano').value=m[1].trim();

    // Store file for later processing after OT is created
    window._pendingF07={file,text,arrayBuffer};

    dz.classList.add('loaded');
    dzIcon.textContent='✅';
    dzText.innerHTML='<strong>'+file.name+'</strong><br><small style="color:var(--green)">Datos extraídos — revisá y creá la OT</small>';
    document.getElementById('new-ot').focus();
  }catch(err){
    dzIcon.textContent='⚠️';
    dzText.innerHTML='<span style="color:var(--red)">No se pudo leer el archivo</span>';
    console.error(err);
  }
}

function newOTdzDrop(e){
  e.preventDefault();
  dzLeave('new-ot-dz');
  const f=e.dataTransfer.files[0];
  if(f) newOTloadF07(f);
}

function createOT(){
  const num = document.getElementById('new-ot').value.trim();
  if(!num){ alert('Ingresá el número de OT.'); return; }
  if(db.ots.find(o=>o.num===num)){ alert('Ya existe una OT con ese número.'); return; }
  const ot = {
    id:'ot_'+Date.now(),
    num,
    cliente: document.getElementById('new-cliente').value.trim().toUpperCase(),
    obra:    document.getElementById('new-obra').value.trim().toUpperCase(),
    plano:   document.getElementById('new-plano').value.trim(),
    anio:    String(new Date().getFullYear()),
    estado:  'active',
    items:   undefined,   // set by F-07; undefined = no auto-match for procedures
    f07s:    [],
    createdAt: new Date().toISOString()
  };
  db.ots.unshift(ot);
  saveDB();
  closeModal('modal-new-ot');
  renderSidebar();
  currentOT = ot.id;
  currentTab = 'datos';
  renderOT();
  // If F07 was dropped in the modal, process it now
  if(window._pendingF07){
    const {file,text,arrayBuffer:f07ab}=window._pendingF07;
    window._pendingF07=null;
    setTimeout(()=>{
      if(f07ab) window._lastF07ArrayBuffer=f07ab;
      processF07(text, file.name);
    },300);
  }
}

function selectOT(id){
  currentOT = id;
  currentTab = 'datos';
  currentScreen = 'ot';
  updateHomeButton();
  renderOT();
}

function confirmDeleteOT(){
  const ot = db.ots.find(o=>o.id===currentOT);
  if(!ot) return;
  if(!confirm(`¿Eliminar la OT ${ot.num} – ${ot.cliente}?\nEsta acción no se puede deshacer.`)) return;
  // Delete F07 files from IDB
  (ot.f07s||[]).forEach(f => { if(f.id) idbDelete(f.id).catch(()=>{}); });
  // Delete from cloud
  const otId = currentOT;
  if(syncEnabled) {
    fetch(SUPA_URL + '/rest/v1/ots?id=eq.' + otId, {method:'DELETE', headers: supaHeaders()}).catch(()=>{});
  }
  // Delete from db
  db.ots = db.ots.filter(o=>o.id!==currentOT);
  currentOT = null;
  saveDB();
  showOTList();
}

function openEditModal(){
  const ot = db.ots.find(o=>o.id===currentOT);
  if(!ot) return;
  document.getElementById('edit-ot').value=ot.num;
  document.getElementById('edit-cliente').value=ot.cliente;
  document.getElementById('edit-obra').value=ot.obra||'';
  document.getElementById('edit-plano').value=ot.plano||'';
  document.getElementById('edit-anio').value=ot.anio||'';
  document.getElementById('edit-estado').value=ot.estado||'active';
  document.getElementById('modal-edit-ot').style.display='flex';
}

function saveEditOT(){
  const ot = db.ots.find(o=>o.id===currentOT);
  if(!ot) return;
  ot.cliente = document.getElementById('edit-cliente').value.trim().toUpperCase();
  ot.obra    = document.getElementById('edit-obra').value.trim().toUpperCase();
  ot.plano   = document.getElementById('edit-plano').value.trim();
  ot.anio    = document.getElementById('edit-anio').value.trim();
  ot.estado  = document.getElementById('edit-estado').value;
  saveDB(); closeModal('modal-edit-ot');
  renderSidebar(); renderOT();
}

function deleteCurrentOT(){
  const ot = db.ots.find(o=>o.id===currentOT);
  if(!ot) return;
  if(!confirm(`¿Eliminar OT ${ot.num}? Esta acción no se puede deshacer.`)) return;
  db.ots = db.ots.filter(o=>o.id!==currentOT);
  saveDB(); closeModal('modal-edit-ot');
  currentOT=null;
  showOTList();
}

// ── Render OT ────────────────────────────────────────────────────────────────

function renderOT(){
  const ot = db.ots.find(o=>o.id===currentOT);
  if(!ot) return;
  currentScreen = 'ot';
  if(typeof updateHomeButton==='function') updateHomeButton();
  document.getElementById('topbar-title').textContent=`OT ${ot.num} · ${ot.cliente}`;
  document.getElementById('topbar-actions').innerHTML=`
    <button class="btn btn-secondary btn-sm" onclick="showOTList()">← OTs</button>
    <button class="btn btn-secondary btn-sm" onclick="openEditModal()">✏️ Editar OT</button>
    <button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red-light)"
      onclick="confirmDeleteOT()">🗑 Eliminar</button>
    <button class="btn btn-primary btn-sm" onclick="switchTab('generar')">⬇ Generar carátulas</button>`;

  const tabs = ['datos','f07','items','procedimientos','generar'];
  const tabLabels = {datos:'Datos',f07:'F-07',items:'Ítems del databook',procedimientos:'Procedimientos',generar:'Generar'};

  document.getElementById('main-content').innerHTML=`
    <div class="fade-in">
      <div class="ot-header">
        <div class="ot-header-left">
          <h1>OT ${ot.num}</h1>
          <div class="sub">${ot.cliente}${ot.obra?' · '+ot.obra:''}</div>
        </div>
        <span class="badge ${STATUS_BADGE[ot.estado||'active']}">${STATUS_LABELS[ot.estado||'active']}</span>
      </div>
      <div class="tabs">
        ${tabs.map(t=>`<div class="tab ${currentTab===t?'active':''}" onclick="switchTab('${t}')">${tabLabels[t]}</div>`).join('')}
      </div>
      <div id="tab-content"></div>
    </div>`;
  renderTab();
}

function switchTab(t){ currentTab=t; renderTab(); 
  document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',el.textContent.trim()===({datos:'Datos',f07:'F-07',items:'Ítems del databook',generar:'Generar'}[t])));
}

function renderTab(){
  const ot = db.ots.find(o=>o.id===currentOT);
  const el = document.getElementById('tab-content');
  if(!el||!ot) return;
  if(currentTab==='datos') renderTabDatos(ot,el);
  else if(currentTab==='f07') renderTabF07(ot,el);
  else if(currentTab==='items') renderTabItems(ot,el);
  else if(currentTab==='procedimientos') renderTabProcedimientos(ot,el);
  else if(currentTab==='generar') renderTabGenerar(ot,el);
}

// ── Tab: Datos ───────────────────────────────────────────────────────────────

function renderTabDatos(ot,el){
  el.innerHTML=`
    <div class="card">
      <div class="card-header">
        <span class="card-title">Información del proyecto</span>
      </div>
      <div class="fields">
        <div class="field"><label>OT N°</label><input type="text" id="d-num" value="${esc(ot.num)}" disabled></div>
        <div class="field"><label>Cliente</label><input type="text" id="d-cliente" value="${esc(ot.cliente)}" oninput="autosaveField('cliente',this.value.toUpperCase())"></div>
        <div class="field full"><label>Obra / Equipo</label><input type="text" id="d-obra" value="${esc(ot.obra||'')}" placeholder="Descripción del equipo o estructura" oninput="autosaveField('obra',this.value.toUpperCase())"></div>
        <div class="field"><label>N° Plano</label><input type="text" id="d-plano" value="${esc(ot.plano||'')}" oninput="autosaveField('plano',this.value)"></div>
        <div class="field"><label>Año</label><input type="text" id="d-anio" value="${esc(ot.anio||'')}" oninput="autosaveField('anio',this.value)"></div>
        <div class="field"><label>Tipo (afecta detección de ítems)</label>
          <select id="d-tipo" onchange="autosaveField('tipo',this.value)">
            <option value="" ${!ot.tipo?'selected':''}>Sin definir</option>
            <option value="equipos" ${ot.tipo==='equipos'?'selected':''}>Equipos (tanques, recipientes)</option>
            <option value="estructuras" ${ot.tipo==='estructuras'?'selected':''}>Estructuras</option>
            <option value="ambos" ${ot.tipo==='ambos'?'selected':''}>Ambos</option>
          </select>
        </div>
        <div class="field full"><label>Estado</label>
          <select id="d-estado" onchange="autosaveField('estado',this.value)">
            <option value="active" ${ot.estado==='active'?'selected':''}>En proceso</option>
            <option value="pending" ${ot.estado==='pending'?'selected':''}>Pendiente</option>
            <option value="done" ${ot.estado==='done'?'selected':''}>Terminada</option>
          </select>
        </div>
      </div>
      <div style="margin-top:10px;font-size:11px;color:var(--text3)">Los cambios se guardan automáticamente.</div>
    </div>`;
}

function autosaveField(key,val){
  const ot = db.ots.find(o=>o.id===currentOT);
  if(!ot) return;
  ot[key]=val;
  // Save locally + push this OT to cloud immediately
  try{ const safe=JSON.parse(JSON.stringify(db)); safe.procedures.forEach(p=>{delete p.data;}); localStorage.setItem('cimomet_db',JSON.stringify(safe)); }catch(e){}
  pushOT(ot);
  setSyncStatus('ok','Guardado'); setTimeout(()=>setSyncStatus('idle'),2000);
  if(key==='cliente'||key==='estado'){renderSidebar();}
  if(key==='estado'){
    document.querySelectorAll('.badge').forEach(b=>{
      b.className='badge '+STATUS_BADGE[val];
      b.textContent=STATUS_LABELS[val];
    });
  }
}

// ── Tab: F-07 ────────────────────────────────────────────────────────────────

