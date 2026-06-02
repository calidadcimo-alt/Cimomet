// ════════════════════════════════════════════════════════════
// app.js — Inicialización y utilidades de modales
// ════════════════════════════════════════════════════════════

function closeModal(id){document.getElementById(id).style.display='none';}

function closeModalIf(e,id){if(e.target.id===id)closeModal(id);}

// ── Init ─────────────────────────────────────────────────────────────────────
loadDB();
renderSidebar();
// Pull latest from cloud in background, then refresh UI
syncFromCloud().then(ok => {
  if(ok){ renderSidebar(); if(currentOT){ const o=db.ots.find(x=>x.id===currentOT); if(o) renderOT(); else { currentOT=null; } } }
});
// Keyboard shortcut: ESC closes modals
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    ['modal-new-ot','modal-edit-ot'].forEach(id=>{
      const m=document.getElementById(id);if(m) m.style.display='none';
    });
  }
});


// ── Inicialización ──────────────────────────────────────────
loadDB();
renderSidebar();
// Pull latest from cloud in background, then refresh UI
syncFromCloud().then(ok => {
  if(ok){ renderSidebar(); if(currentOT){ const o=db.ots.find(x=>x.id===currentOT); if(o) renderOT(); else { currentOT=null; } } }
});
// Keyboard shortcut: ESC closes modals
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    ['modal-new-ot','modal-edit-ot'].forEach(id=>{
      const m=document.getElementById(id);if(m) m.style.display='none';
    });
  }
});
