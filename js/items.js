// ════════════════════════════════════════════════════════════
// items.js — Ítems del databook y biblioteca
// ════════════════════════════════════════════════════════════

function renderTabItems(ot,el){
  // If items not yet persisted, initialize from defaults and save immediately
  if(!ot.items){
    ot.items=[...DEFAULT_ITEMS,...ALL_ITEMS.filter(i=>!DEFAULT_ITEMS.includes(i))];
    // Actually just use ALL_ITEMS as default — user hasn't customized yet
    ot.items=[...ALL_ITEMS];
    saveDB();
  }
  const selected=ot.items;
  const customOT=ot.customItems||[];
  const library=db.customLibrary||[];

  // Build full item list: standard + custom for this OT
  const allForOT=[...ALL_ITEMS,...customOT];

  el.innerHTML=`
    <div class="card">
      <div class="card-header">
        <span class="card-title">Ítems del databook</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="setAllItems(true)">Marcar todos</button>
          <button class="btn btn-secondary btn-sm" onclick="setAllItems(false)">Desmarcar todos</button>
        </div>
      </div>
      <p style="font-size:13px;color:var(--text3);margin-bottom:12px">
        ${ot.f07s&&ot.f07s.length?'Detectados desde el F-07. Podés ajustar o agregar ensayos adicionales.':'Seleccioná los ítems o agregá ensayos personalizados.'}
      </p>

      <div class="card-title" style="margin-bottom:8px">Ítems estándar</div>
      <div class="items-grid" id="items-grid-container">
        ${ALL_ITEMS.map((item,i)=>{
          const isChecked = selected.includes(item);
          const isDefault = DEFAULT_ITEMS.includes(item);
          return `<div class="item-row ${isChecked?'checked':''}" id="irow-std-${i}" onclick="toggleStdItem(${i})">
            <input type="checkbox" id="ichk-std-${i}" ${isChecked?'checked':''}
              onclick="event.stopPropagation();toggleStdItem(${i})">
            <span>${item}</span>
            ${isDefault&&!isChecked?'<span style="font-size:10px;color:var(--text3);margin-left:auto">default</span>':''}
          </div>`;
        }).join('')}
      </div>

      ${customOT.length>0?`
      <div class="card-title" style="margin-top:16px;margin-bottom:8px">Ensayos y pruebas adicionales <span class="chip">${customOT.length}</span></div>
      <div style="display:flex;flex-direction:column;gap:6px" id="custom-items-list">
        ${customOT.map((item,i)=>`
          <div class="item-row checked" style="justify-content:space-between">
            <div style="display:flex;align-items:center;gap:8px">
              <input type="checkbox" checked onclick="event.stopPropagation();toggleCustomItem(${i})">
              <span>${item}</span>
            </div>
            <button class="btn btn-danger btn-sm" style="padding:3px 8px;font-size:11px" onclick="removeCustomItem(${i})">✕</button>
          </div>`).join('')}
      </div>`:
      '<div style="margin-top:12px"></div>'}

      <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="openAddCustomModal()">+ Nuevo ensayo / prueba</button>
        ${library.length>0?`<button class="btn btn-secondary btn-sm" onclick="openLibraryModal()">📚 Desde biblioteca (${library.length})</button>`:''}
      </div>

      <div style="margin-top:10px;font-size:12px;color:var(--text3)" id="items-count-label">
        ${selected.length + customOT.length} ítems seleccionados en total
      </div>
    </div>`;
}

function toggleStdItem(i){
  const ot=db.ots.find(o=>o.id===currentOT);
  if(!ot) return;
  if(!ot.items) ot.items=[...ALL_ITEMS];
  const item=ALL_ITEMS[i];
  const idx=ot.items.indexOf(item);
  if(idx>=0) ot.items.splice(idx,1); else ot.items.push(item);
  saveDB();
  const cb=document.getElementById('ichk-std-'+i);
  const row=document.getElementById('irow-std-'+i);
  if(cb) cb.checked=ot.items.includes(item);
  if(row) row.classList.toggle('checked',ot.items.includes(item));
  const lbl=document.getElementById('items-count-label');
  if(lbl){
    const ot2=db.ots.find(o=>o.id===currentOT);
    lbl.textContent=`${(ot2.items||[]).length+(ot2.customItems||[]).length} ítems seleccionados en total`;
  }
}

function toggleCustomItem(i){
  // Custom items are always selected when present; remove to deselect
  removeCustomItem(i);
}

function removeCustomItem(i){
  const ot=db.ots.find(o=>o.id===currentOT);
  if(!ot||!ot.customItems) return;
  ot.customItems.splice(i,1);
  saveDB(); renderTab();
}

function openAddCustomModal(){
  document.getElementById('modal-custom-item').style.display='flex';
  document.getElementById('custom-item-input').value='';
  document.getElementById('custom-item-save-lib').checked=true;
  setTimeout(()=>document.getElementById('custom-item-input').focus(),50);
}

function closeAddCustomModal(){
  document.getElementById('modal-custom-item').style.display='none';
}

function saveCustomItem(){
  const name=document.getElementById('custom-item-input').value.trim().toUpperCase();
  if(!name){alert('Ingresá el nombre del ítem.');return;}
  const ot=db.ots.find(o=>o.id===currentOT);
  if(!ot) return;
  if(!ot.customItems) ot.customItems=[];
  if(ot.customItems.includes(name)){alert('Este ítem ya está en la lista.');return;}
  ot.customItems.push(name);
  // Save to library if checked
  const saveToLib=document.getElementById('custom-item-save-lib').checked;
  if(saveToLib){
    if(!db.customLibrary) db.customLibrary=[];
    if(!db.customLibrary.includes(name)) db.customLibrary.push(name);
  }
  saveDB(); closeAddCustomModal(); renderTab();
}

function openLibraryModal(){
  const library=db.customLibrary||[];
  const ot=db.ots.find(o=>o.id===currentOT);
  const existing=(ot&&ot.customItems)||[];
  const list=document.getElementById('library-items-list');
  list.innerHTML=library.map((item,i)=>`
    <div class="item-row ${existing.includes(item)?'checked':''}" onclick="toggleLibraryItem(${i})" id="lib-row-${i}">
      <input type="checkbox" ${existing.includes(item)?'checked':''} onclick="event.stopPropagation();toggleLibraryItem(${i})" id="lib-chk-${i}">
      <span style="flex:1">${item}</span>
      <button class="btn btn-danger btn-sm" style="padding:2px 7px;font-size:11px" onclick="event.stopPropagation();deleteFromLibrary(${i})">✕</button>
    </div>`).join('') || '<div style="font-size:13px;color:var(--text3)">La biblioteca está vacía.</div>';
  document.getElementById('modal-library').style.display='flex';
}

function toggleLibraryItem(i){
  const ot=db.ots.find(o=>o.id===currentOT);
  if(!ot) return;
  if(!ot.customItems) ot.customItems=[];
  const item=db.customLibrary[i];
  const idx=ot.customItems.indexOf(item);
  if(idx>=0) ot.customItems.splice(idx,1); else ot.customItems.push(item);
  saveDB();
  const cb=document.getElementById('lib-chk-'+i);
  const row=document.getElementById('lib-row-'+i);
  if(cb) cb.checked=ot.customItems.includes(item);
  if(row) row.classList.toggle('checked',ot.customItems.includes(item));
}

function deleteFromLibrary(i){
  if(!confirm('¿Eliminar este ítem de la biblioteca?')) return;
  db.customLibrary.splice(i,1);
  saveDB(); openLibraryModal();
}

function closeLibraryModal(){
  document.getElementById('modal-library').style.display='none';
  renderTab();
}

function setAllItems(check){
  const ot=db.ots.find(o=>o.id===currentOT);
  if(!ot) return;
  ot.items=check?[...ALL_ITEMS]:[];
  saveDB(); renderTab();
}

// ── Tab: Generar ─────────────────────────────────────────────────────────────

function sortItems(ot) {
  if(!ot.items) return;
  const INSERT_AFTER = ALL_ITEMS.indexOf('INFORME DE ULTRASONIDO'); // 9 → custom after here
  ot.items.sort((a, b) => {
    const ia = ALL_ITEMS.indexOf(a);
    const ib = ALL_ITEMS.indexOf(b);
    // Effective position: custom items get INSERT_AFTER + 0.5 so they sort between pos 9 and 10
    const pa = ia >= 0 ? ia : INSERT_AFTER + 0.5;
    const pb = ib >= 0 ? ib : INSERT_AFTER + 0.5;
    if(pa !== pb) return pa - pb;
    // Both custom: alphabetical
    return a.localeCompare(b, 'es');
  });
}

function injectCustomItems(doc, customItems){
  if(!customItems||!customItems.length) return doc;

  // Find the anchor paragraph: INFORME DE ULTRASONIDO separator (numId=2)
  // We insert AFTER it (or after INFORME DE GAMMAGRAFIA if ULTRASONIDO was removed)
  // Strategy: find the last separator before INFORME DE TRATAMIENTO SUPERFICIAL
  // and insert custom items after it

  // Find a separator paragraph to use as template (copy structure, replace text)
  // Use INFORME DE GAMMAGRAFIA as the template paragraph
  const templateRe=/<w:p[ >](?:(?!<w:p[ >]).)*<w:numId w:val="2"\/>(?:(?!<\/w:p>).)*INFORME DE GAMMAGRAFIA(?:(?!<\/w:p>).)*<\/w:p>/s;
  const tmplMatch=doc.match(templateRe);
  if(!tmplMatch) return doc; // fallback: no template found

  const templatePara=tmplMatch[0];

  // Find INFORME DE TRATAMIENTO SUPERFICIAL separator and its preceding blanks
  // We insert the custom items + their blank pages BEFORE tratamiento
  const tratRe=/<w:p[ >](?:(?!<w:p[ >]).)*<w:numId w:val="2"\/>(?:(?!<\/w:p>).)*INFORME DE TRATAMIENTO SUPERFICIAL(?:(?!<\/w:p>).)*<\/w:p>/s;
  const tratMatch=doc.match(tratRe);

  // Build insertion: for each custom item, create [10 blank paras][separator+PB]
  // Get a blank paragraph template
  const blankRe=/<w:p><w:pPr><w:pStyle w:val="Normal"\/><w:tabs><w:tab w:val="clear" w:pos="708"\/><w:tab w:val="left" w:pos="142" w:leader="none"\/><\/w:tabs><w:snapToGrid w:val="false"\/><w:ind w:left="720" w:right="0"\/><w:jc w:val="both"\/><w:rPr><w:b\/><w:sz w:val="28"\/><w:szCs w:val="28"\/><\/w:rPr><\/w:pPr><w:r><w:rPr><w:b\/><w:sz w:val="28"\/><w:szCs w:val="28"\/><\/w:rPr><\/w:r><\/w:p>/;
  const blankMatch=doc.match(blankRe);
  const blankPara=blankMatch?blankMatch[0]:'<w:p><w:pPr><w:pStyle w:val="Normal"/><w:snapToGrid w:val="false"/><w:jc w:val="both"/><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:r></w:p>';

  let insertion='';
  for(const item of customItems){
    // 10 blank paragraphs
    insertion+=blankPara.repeat(10);
    // Separator paragraph: copy template, replace text
    const sepPara=templatePara.replace(
      /<w:t>INFORME DE GAMMAGRAFIA<\/w:t>/,
      '<w:t>'+item+'</w:t>'
    );
    insertion+=sepPara;
  }

  // Also add the custom items to the INDEX (numId=3)
  // Find the last numId=3 paragraph before tratamiento or actas
  const indexInsertRe=/((?:<w:p[ >](?:(?!<w:p[ >]).)*<w:numId w:val="3"\/>(?:(?!<\/w:p>).)*<w:t>INFORME DE GAMMAGRAFIA<\/w:t>(?:(?!<\/w:p>).)*<\/w:p>))/s;
  let docWithIndex=doc;
  const idxMatch=docWithIndex.match(indexInsertRe);
  if(idxMatch){
    // Build index entries for custom items
    // Use a numId=3 paragraph as template
    const idxTmplRe=/<w:p[ >](?:(?!<w:p[ >]).)*<w:numId w:val="3"\/>(?:(?!<\/w:p>).)*INFORME DE GAMMAGRAFIA(?:(?!<\/w:p>).)*<\/w:p>/s;
    const idxTmpl=docWithIndex.match(idxTmplRe);
    if(idxTmpl){
      let idxInsertion='';
      for(const item of customItems){
        idxInsertion+=idxTmpl[0].replace(
          /<w:t>INFORME DE GAMMAGRAFIA<\/w:t>/,
          '<w:t>'+item+'</w:t>'
        );
      }
      docWithIndex=docWithIndex.replace(idxTmpl[0], idxTmpl[0]+idxInsertion);
    }
  }

  // Insert separator pages before tratamiento superficial
  if(tratMatch){
    // Find the 10 blank paras before tratamiento and insert before them
    const tratIdx=docWithIndex.indexOf(tratMatch[0]);
    // Find start of the 10 blanks before tratamiento
    // Go back from tratIdx to find the last non-blank (previous separator)
    let insertPos=tratIdx;
    // Count back 10 blank paragraphs
    let blanksToSkip=10;
    let searchDoc=docWithIndex.slice(0,tratIdx);
    // Find last 10 blank paragraphs by looking for pagebreak separator before them
    const prevSepRe=/<w:br w:type="page"\/>/g;
    let lastPBIdx=-1;
    let pbMatch;
    while((pbMatch=prevSepRe.exec(searchDoc))!==null) lastPBIdx=pbMatch.index;
    if(lastPBIdx>0){
      // Find the paragraph containing this page break
      const pbParaStart=searchDoc.lastIndexOf('<w:p',lastPBIdx);
      const pbParaEnd=searchDoc.indexOf('</w:p>',lastPBIdx)+6;
      insertPos=pbParaEnd; // insert right after the previous separator's paragraph
    }
    docWithIndex=docWithIndex.slice(0,insertPos)+insertion+docWithIndex.slice(insertPos);
  } else {
    // No tratamiento found - insert before ACTAS
    const actasRe=/<w:p[ >](?:(?!<w:p[ >]).)*<w:numId w:val="2"\/>(?:(?!<\/w:p>).)*ACTA(?:(?!<\/w:p>).)*<\/w:p>/s;
    const actasMatch=docWithIndex.match(actasRe);
    if(actasMatch){
      docWithIndex=docWithIndex.replace(actasMatch[0], insertion+actasMatch[0]);
    } else {
      docWithIndex+=insertion; // last resort
    }
  }

  return docWithIndex;
}

