# Cimomet · Databook Manager

Aplicación web para gestión de databooks de calidad por OT (orden de trabajo).
Funciona 100% en el navegador, con sincronización en la nube vía Supabase.

## Estructura del proyecto

```
cimomet/
├── index.html              ← Página principal (estructura HTML)
├── css/
│   └── styles.css          ← Todos los estilos
└── js/
    ├── config.js           ← Constantes: items, keywords, categorías, credenciales Supabase
    ├── utils.js            ← Funciones auxiliares (escape de texto, normalización)
    ├── storage.js          ← Almacenamiento local (localStorage + IndexedDB)
    ├── sync.js             ← Sincronización con Supabase (subir/bajar datos y archivos)
    ├── ots.js              ← Órdenes de Trabajo: sidebar, alta/baja/edición, pestaña Datos
    ├── f07.js              ← Carga y lectura del Plan de Inspección F-07 (.doc/.docx)
    ├── items.js            ← Ítems del databook y biblioteca de ítems custom
    ├── procedimientos.js   ← Biblioteca de procedimientos y asignación a OTs
    ├── caratulas.js        ← Generación de carátulas Word (.docx)
    └── app.js              ← Inicialización y utilidades de modales
```

## Orden de carga de los scripts

Los módulos se cargan en este orden (definido en `index.html`). Importa porque
`config.js` define las variables globales que el resto usa, y `app.js` arranca la app:

1. config.js  2. utils.js  3. storage.js  4. sync.js  5. ots.js
6. f07.js  7. items.js  8. procedimientos.js  9. caratulas.js  10. app.js

## Cómo editar

- **Cambiar credenciales de Supabase o listas de ítems/categorías** → `config.js`
- **Tocar la sincronización con la nube** → `sync.js`
- **Modificar la lógica de procedimientos (asignación, matching PST)** → `procedimientos.js`
- **Ajustar la generación de carátulas Word** → `caratulas.js`
- **Cambiar estilos/colores** → `css/styles.css`

## Cómo publicar (GitHub Pages)

Subí los archivos manteniendo la estructura de carpetas (index.html en la raíz,
js/ y css/ como subcarpetas). GitHub Pages sirve index.html automáticamente.

## Cómo probar localmente

No se puede abrir `index.html` con doble click (las llamadas a Supabase fallan por
seguridad del protocolo file://). Usá un servidor local:

```
# Con Python instalado:
python -m http.server 8000
# Luego abrí http://localhost:8000 en el navegador
```

O usá la extensión **Live Server** de Visual Studio Code (botón "Go Live").

## Dependencias externas (CDN)

- **JSZip** — para generar archivos .docx (se carga desde cdnjs en index.html)
- **Google Fonts** — DM Sans y DM Mono

## Almacenamiento

- **localStorage** → metadatos (OTs, ítems, configuración)
- **IndexedDB** → archivos de procedimientos y F-07 (base64)
- **Supabase** → sincronización en la nube:
  - Tablas: `ots`, `procedures_end`, `procedures_sup`, `procedures_wps`, `library`
  - Storage bucket `files` → archivos para acceso cross-device
