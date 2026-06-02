// ════════════════════════════════════════════════════════════
// utils.js — Funciones auxiliares (escape, normalización)
// ════════════════════════════════════════════════════════════

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function escXml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

const ALL_SEP_NORM=[
  "PLAN DE INSPECCION Y ENSAYOS","CERTIFICADOS DE MATERIALES","WPS Y PQR","WPQ",
  "PROCEDIMIENTO DE END","PROCEDIMIENTOS DE END","PROCEDIMIENTO DE TRATAMIENTO SUPERFICIAL",
  "PROTOCOLO DE CONTROL DIMENSIONAL","PROTOCOLOS DE CONTROL DIMENSIONAL",
  "INFORMES DE LIQUIDOS PENETRANTES","INFORME DE LIQUIDOS PENETRANTES",
  "INFORME DE GAMMAGRAFIA","INFORMDE DE ULTRASONIDO","INFORME DE ULTRASONIDO",
  "INFORME DE TRATAMIENTO SUPERFICIAL",
  "ACTAS DE INSPECCION","ACTA DE INSPECCION","ACTAS DE INSPECCIÓN",
  "ACTAS DE LIBERACION","ACTA DE LIBERACION"
];

function nrm(s){return s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9 ]/g,'').trim();}

function stem(s){
  // Strip trailing S from each word for singular/plural matching
  return nrm(s).split(' ').map(w=>w.length>3?w.replace(/S$/,''):w).join(' ');
}

function b64ToBytes(b64){const bin=atob(b64);const b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);return b;}

function isSelected(text,selectedItems){
  const t=nrm(text);
  const ts=stem(text);
  return selectedItems.some(s=>{
    const n=nrm(s);
    const ns=stem(s);
    return n===t||n.includes(t)||t.includes(n)||ns===ts||ns.includes(ts)||ts.includes(ns);
  });
}

