// ════════════════════════════════════════════════════════════
// app.js — Inicialización y utilidades de modales
// ════════════════════════════════════════════════════════════

function closeModal(id){document.getElementById(id).style.display='none';}

function closeModalIf(e,id){if(e.target.id===id)closeModal(id);}

// ── Init ─────────────────────────────────────────────────────
loadDB();
restoreNavState();   // volver a la última pantalla (desde cache local)
// Traer lo último de la nube; al terminar, re-aplicar la pantalla con datos frescos
// y arrancar el refresco automático (polling) cada 15 s.
syncFromCloud().then(ok => {
  if(ok && typeof restoreNavState === 'function') restoreNavState();
  if(typeof startPolling === 'function') startPolling(15000);
});

// Keyboard shortcut: ESC closes modals
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    ['modal-new-ot','modal-edit-ot'].forEach(id=>{
      const m=document.getElementById(id);if(m) m.style.display='none';
    });
  }
});
