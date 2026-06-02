// ════════════════════════════════════════════════════════════
// caratulas.js — Generación de carátulas Word (.docx)
// ════════════════════════════════════════════════════════════

function renderTabGenerar(ot,el){
  const items=ot.items||[...ALL_ITEMS];
  el.innerHTML=`
    <div class="card">
      <div class="card-header"><span class="card-title">Resumen</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:4px">
        <div style="background:var(--surface2);border-radius:var(--r);padding:12px 14px">
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">OT</div>
          <div style="font-size:18px;font-family:var(--font);font-weight:700">${esc(ot.num)}</div>
        </div>
        <div style="background:var(--surface2);border-radius:var(--r);padding:12px 14px">
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Cliente</div>
          <div style="font-size:16px;font-weight:600">${esc(ot.cliente||'—')}</div>
        </div>
        <div style="background:var(--surface2);border-radius:var(--r);padding:12px 14px">
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Ítems</div>
          <div style="font-size:18px;font-family:var(--font);font-weight:700">${items.length}</div>
        </div>
      </div>
      ${ot.obra?`<div style="font-size:13px;color:var(--text3);padding:8px 0">${esc(ot.obra)}</div>`:''}
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Ítems incluidos</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${items.map(it=>`<span class="chip">✓ ${esc(it)}</span>`).join('')}
        ${items.length===0?'<span style="font-size:13px;color:var(--text3)">Sin ítems seleccionados. Ir a la pestaña "Ítems del databook".</span>':''}
      </div>
    </div>
    <div class="progress" id="gen-progress"><div class="progress-bar" id="gen-pbar"></div></div>
    <div class="status-msg" id="gen-status"></div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-primary btn-lg" id="btn-gen-now" onclick="generateCaratulas()" ${items.length===0?'disabled':''}>
        ⬇ Generar carátulas .docx
      </button>
    </div>
    <div id="gen-result" style="display:none;margin-top:12px">
      <div class="card" style="border-color:var(--green)">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:24px">✅</div>
          <div>
            <div style="font-weight:600">Carátulas generadas</div>
            <div style="font-size:12px;color:var(--text3)" id="gen-result-desc"></div>
          </div>
          <div style="margin-left:auto">
            <div style="display:flex;gap:8px">
              <a class="btn btn-success" id="btn-download" href="#" download="" style="flex:1;justify-content:center">
                <svg width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M5 20h14v-2H5v2zm7-18v10.59l-3.29-3.3-1.42 1.42L12 16l4.71-4.71-1.42-1.42L13 13.17V2h-1z"/></svg>
                Descargar .docx
              </a>
              <button onclick="printGeneratedDoc()" style="padding:10px 14px;background:#185FA5;color:white;border:none;border-radius:var(--r);cursor:pointer;display:flex;align-items:center" title="Imprimir">
                <svg width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

// Fix Word 2007 compatibility: replace OOXML strict names with transitional names

function fixWord2007(xml){
  // Alignment values: strict -> transitional
  xml=xml.replace(/w:val="start"/g,'w:val="left"');
  xml=xml.replace(/w:val="end"/g,'w:val="right"');
  // Cell margin elements
  xml=xml.replace(/<w:start (w:w="[^"]*" w:type="[^"]*")\/>/g,'<w:left $1/>');
  xml=xml.replace(/<w:end (w:w="[^"]*" w:type="[^"]*")\/>/g,'<w:right $1/>');
  // w:ind attributes
  xml=xml.replace(/(<w:ind[^>]*)w:start=/g,'$1w:left=');
  xml=xml.replace(/(<w:ind[^>]*)w:end=/g,'$1w:right=');
  // Remove title="" from wp:docPr (Word 2007 doesn't support it)
  xml=xml.replace(/\s+title="[^"]*"/g,'');
  // Collapse empty wp:docPr: ...></wp:docPr> -> .../>
  xml=xml.replace(/(<wp:docPr[^>]*)><\/wp:docPr>/g,'$1/>');
  // Remove Word 2010+ namespaces and mc:Ignorable
  xml=xml.replace(/\s+xmlns:w14="[^"]*"/g,'');
  xml=xml.replace(/\s+xmlns:w15="[^"]*"/g,'');
  xml=xml.replace(/\s+xmlns:wp14="[^"]*"/g,'');
  xml=xml.replace(/\s+xmlns:mc="[^"]*"/g,'');
  xml=xml.replace(/\s+mc:Ignorable="[^"]*"/g,'');
  return xml;
}

async function generateCaratulas(){
  const ot=db.ots.find(o=>o.id===currentOT);
  if(!ot) return;
  if(currentTab!=='generar'){switchTab('generar');setTimeout(()=>generateCaratulas(),200);return;}
  const items=ot.items||[...ALL_ITEMS];
  if(!items.length){alert('Seleccioná al menos un ítem.');return;}

  const btn=document.getElementById('btn-gen-now');
  const prog=document.getElementById('gen-progress');
  const pbar=document.getElementById('gen-pbar');
  const status=document.getElementById('gen-status');
  const result=document.getElementById('gen-result');

  if(btn) btn.disabled=true;
  if(result) result.style.display='none';
  if(prog) prog.style.display='block';
  if(status) status.textContent='Leyendo plantilla...';
  if(pbar) pbar.style.width='15%';

  try{
    // Load template with JSZip
    const templateBytes = b64ToBytes(TEMPLATE_B64);
    if(pbar) pbar.style.width='30%';
    if(status) status.textContent='Procesando ZIP...';

    const zip = await JSZip.loadAsync(templateBytes);

    if(pbar) pbar.style.width='50%';
    if(status) status.textContent='Editando XML...';

    // Edit header1.xml
    const hdrFile = zip.file('word/header1.xml');
    if(hdrFile){
      let h = await hdrFile.async('string');
      h = h.replace(/>OT\. N°: [^<]+</g, `>OT. N°: ${escXml(ot.num||'XX')}<`);
      // Replace cliente - handle various patterns
      h = h.replace(/(<w:t[^>]*> )(AESA|TERNIUM|[A-Z]+)\.<\/w:t>/g, `$1${escXml(ot.cliente||'CLIENTE')}.</w:t>`);
      // Replace obra - the last bold text run in header
      h = h.replace(/<w:t>(Estructuras[^<]*|CAMPANAS[^<]*)<\/w:t>/g, `<w:t>${escXml(ot.obra||'OBRA')}.</w:t>`);
      zip.file('word/header1.xml', fixWord2007(h));
    }

    // Edit footer1.xml (year)
    const ftrFile = zip.file('word/footer1.xml');
    if(ftrFile){
      let f = await ftrFile.async('string');
      f = f.replace(/AÑO \d{4}/g, `AÑO ${escXml(ot.anio||String(new Date().getFullYear()))}`);
      zip.file('word/footer1.xml', fixWord2007(f));
    }

    // Edit document.xml (index items + separator pages)
    const docFile = zip.file('word/document.xml');
    if(docFile){
      let d = await docFile.async('string');
      d = rebuildDoc(d, items);
      // Inject custom items (from OT's customItems list)
      const customItems = ot.customItems||[];
      if(customItems.length>0) d = injectCustomItems(d, customItems);
      zip.file('word/document.xml', fixWord2007(d));
    }

    if(pbar) pbar.style.width='80%';
    if(status) status.textContent='Generando archivo...';

    // Generate output with JSZip (handles CRC and compression correctly)
    const outBytes = await zip.generateAsync({
      type:'uint8array',
      compression:'DEFLATE',
      compressionOptions:{level:6}
    });

    if(pbar) pbar.style.width='100%';

    const blob = new Blob([outBytes], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    const url = URL.createObjectURL(blob);
    const fname = `caratulas_OT${ot.num}_${ot.cliente}.docx`;
    const dlBtn = document.getElementById('btn-download');
    if(dlBtn){dlBtn.href=url;dlBtn.download=fname;}

    setTimeout(()=>{
      if(prog) prog.style.display='none';
      if(status) status.textContent='';
      if(btn) btn.disabled=false;
      if(result) result.style.display='block';
      const desc = document.getElementById('gen-result-desc');
      if(desc) desc.textContent=`OT ${ot.num} · ${ot.cliente} · ${items.length} ítems`;
    },200);

  }catch(err){
    if(prog) prog.style.display='none';
    if(status) status.textContent='Error: '+err.message;
    console.error(err);
    if(btn) btn.disabled=false;
  }
}


// ── DOCX helpers ─────────────────────────────────────────────────────────────

function rebuildDoc(doc,selectedItems){
  function isBlankPara(para){
    // A blank spacer paragraph: no text, no numId, no page break
    const hasText=/<w:t[^>]*>[^<]+<\/w:t>/.test(para);
    const hasNum=/<w:numId/.test(para);
    const hasPB=/<w:br w:type="page"/.test(para);
    return !hasText && !hasNum && !hasPB;
  }
  function shouldRemove(para,numVal){
    if(!para.includes('<w:numId w:val="'+numVal+'"/>')) return false;
    const txts=para.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if(!txts) return false;
    const text=txts.map(t=>t.replace(/<[^>]+>/g,'')).join(' ');
    for(const sep of ALL_SEP_NORM){
      if(nrm(text).includes(nrm(sep))) return !isSelected(sep,selectedItems);
    }
    return false;
  }

  // Collect all top-level paragraphs
  const allParas=[];
  let i=0;
  while(i<doc.length){
    if(doc[i]==='<'&&doc[i+1]==='w'&&doc[i+2]===':'&&doc[i+3]==='p'&&(doc[i+4]===' '||doc[i+4]==='>')){
      const start=i;
      let depth=0,j=i,end=-1;
      while(j<doc.length){
        if(doc[j]==='<'&&doc[j+1]==='w'&&doc[j+2]===':'&&doc[j+3]==='p'&&(doc[j+4]===' '||doc[j+4]==='>')){
          depth++;j+=4;
        }else if(doc[j]==='<'&&doc[j+1]==='/'&&doc[j+2]==='w'&&doc[j+3]===':'&&doc[j+4]==='p'&&doc[j+5]==='>'){
          depth--;
          if(depth===0){end=j+6;break;}
          j+=6;
        }else{j++;}
      }
      if(end<0){i++;continue;}
      allParas.push({text:doc.slice(start,end),start,end,isBlank:false,remove:false});
      i=end;
    }else{i++;}
  }

  // Mark blank paragraphs
  allParas.forEach(p=>{ p.isBlank=isBlankPara(p.text); });

  // Mark separators to remove, and their preceding blank paragraphs
  for(let k=0;k<allParas.length;k++){
    const p=allParas[k];
    if(shouldRemove(p.text,'2')||shouldRemove(p.text,'3')){
      p.remove=true;
      // Also remove the blank paragraphs immediately preceding this separator
      let b=k-1;
      while(b>=0&&allParas[b].isBlank&&!allParas[b].remove){
        allParas[b].remove=true;
        b--;
      }
    }
  }

  // Rebuild: non-paragraph content + kept paragraphs
  const result=[];
  let pos=0;
  for(const p of allParas){
    result.push(doc.slice(pos,p.start)); // content before this para
    if(!p.remove) result.push(p.text);
    pos=p.end;
  }
  result.push(doc.slice(pos));
  return result.join('');
}

// ── Procedures Library ───────────────────────────────────────────────────────

// Map: which procedure types match which databook items

// ── Procedure categories ──────────────────────────────────────────────────────
const PROC_CATEGORIES = {
  'Procedimientos de Ensayos': [
    'Líquidos Penetrantes', 'Radiografía / Gammagrafía', 'Ultrasonido',
    'Visual de Soldaduras', 'Dimensional', 'Prueba Hidráulica', 'Prueba Neumática'
  ],
  'Procedimiento de Pintura / Tratamiento Superficial': [
    'Pintura',
    'Galvanizado',
    'Decapado y Pasivado'
  ],
  'Procedimiento de Soldadura (WPS/PQR)': [
    'WPS / Soldadura'
  ]
};
// Returns category for a given type (custom types go to Ensayos by default)

function printGeneratedDoc() {
  const btn = document.getElementById('btn-dl');
  if(!btn || !btn.href || btn.href === '#') return;
  const win = window.open(btn.href, '_blank');
  if(win) win.addEventListener('load', () => { try{ win.print(); } catch(e){} });
}

