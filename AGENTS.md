# AGENTS.md

Guía para agentes/desarrolladores que trabajen en este repositorio.

## Qué es

App de gestión de fútbol 7 (plantilla, partido en vivo, pizarras, historial y
estadísticas) en **React + Vite**, con backend **Cloudflare Worker + D1**.

- **App desplegada:** https://football-manager.latos.workers.dev
- **Frontend:** `src/App.jsx` (todo el UI), `src/AuthScreen.jsx`, `src/TeamsScreen.jsx`, `src/main.jsx`
- **Lógica pura de partido:** `src/matchLogic.js` (con tests en `src/*.test.js`)
- **Backend:** `worker/src/index.js` (API + assets)
- **DB:** Cloudflare D1 (`migrations/`)
- **Wrangler config:** `wrangler.jsonc` (`account_id`, `database_id` ya configurados)

## Comandos

```bash
npm install
npm test                 # vitest run (88 tests)
npm run build            # vite build -> dist/
npm run dev              # solo frontend (sin API)
npm run dev:worker       # build + wrangler dev (API + frontend + D1 local)
npm run db:migrate:remote
npm run deploy           # build + wrangler deploy
```

Despliegue (Cloudflare). El valor disponible funciona como **Global API Key**
(usar así, no como token):

```powershell
$env:CLOUDFLARE_API_KEY = '<clave>'
$env:CLOUDFLARE_EMAIL   = 'davidciriamayo@gmail.com'
npm run deploy
```

Tras cualquier cambio: **`npm test` + `npm run build` antes de desplegar.**

## Convenciones

- Todo el UI vive en `src/App.jsx` con un objeto `CSS` (plantilla literal) y
  componentes funcionales. Los estilos usan clases `.fm-*` y variables CSS en
  `:root` (`--surface-*`, `--pad`, `--tap`, `--radius`, `--kb-inset`, ...).
- **No usar emojis** salvo petición expresa.
- Los estilos de componentes `.fm-*` son globales (no dependen de `.fm-root`),
  pero **`box-sizing` y tokens heredados sí**: cualquier elemento que se saque
  del árbol de `.fm-root` debe reintroducirlos (ver bug iOS más abajo).
- La lógica de partido (temporizador, tarjetas, sustituciones, notas) está en
  `matchLogic.js` y **debe ir con tests**. No duplicar esa lógica en `App.jsx`.

## ⚠️ Bug de iOS/Safari en hojas (bottom sheets) — NO repetir

Costó mucho depurarlo. Resumen para no volver a romperlo:

### Síntoma
En iPhone, al abrir un popup/hoja inferior (editar jugador, cargar pizarras,
sustituciones, ajustes...), los **botones del pie** (p. ej. *Guardar*) o las
filas **quedaban ocultos por la barra de pestañas** o por el teclado.

### Dos causas distintas (ambas resueltas)

1. **Stacking context en iOS.** El overlay de la hoja se renderizaba **dentro**
   de `.fm-scroll` (subárbol del contenido), mientras `.fm-tabbar` es hermano
   posterior y tiene `backdrop-filter: blur()`. En iOS Safari eso hace que la
   barra se pinte **por encima** de la hoja. Chrome no lo reproducía.
   - ✅ **Solución:** montar las hojas con **`createPortal(..., document.body)`**
     (ver componente `Sheet`). Así el overlay es hijo directo de `<body>`, fuera
     de cualquier contexto de apilamiento, y con `z-index:120` (modales 130).

2. **El teclado no encoge el layout en iOS.** Safari **no** implementa
   `interactive-widget=resizes-content` (WebKit #259770): el teclado se
   superpone y Safari **panea** el `visualViewport`. Intentar redimensionar el
   overlay por JS **empeora** las cosas.
   - ✅ **Solución:** no tocar el layout. Exponer la altura del teclado como
     variable CSS y subir el pie de la hoja:
     `--kb-inset = max(0, innerHeight - visualViewport.height - visualViewport.offsetTop)`
     (hook `useKeyboardInset`, se actualiza en `resize` **y** `scroll` del
     `visualViewport`, con un par de reintentos).
     `.fm-sheet { margin-bottom: var(--kb-inset); max-height: calc(100% - var(--kb-inset)); }`

3. **`box-sizing` al portalear.** Al sacar la hoja de `.fm-root`, los inputs
   (`width:100%` + padding) se **desbordaban** de la pantalla porque
   `.fm-root *{box-sizing:border-box}` ya no aplicaba.
   - ✅ **Solución:** `.fm-overlay, .fm-overlay *{box-sizing:border-box;}` y
     reaplicar `color`/`font-family` en `.fm-sheet`.

4. **Foco de input: "salto" hacia arriba.** `scrollIntoView` mueve ancestros y
   en iOS provoca que la pantalla suba y se pierdan de vista los campos.
   - ✅ **Solución:** en `useFocusReveal` **no** usar `scrollIntoView`. Tras el
     foco (y tras el primer frame del teclado) se comprueba si el input quedaría
     tapado y, solo entonces, se ajusta `scroller.scrollTop` del propio cuerpo
     de la hoja. Nada de `transition` en `margin-bottom` (animar mientras Safari
     reposiciona empeora el salto): el `--kb-inset` se aplica de golpe.

### Reglas de oro
- Toda hoja/modal nueva: usar el componente **`Sheet`** (ya porta a `body` y
  gestiona `--kb-inset` y el foco). No crear overlays a mano dentro del
  contenido.
- Nunca meter `transform`/`filter`/`will-change`/`contain` en un ancestro de un
  `position:fixed` (crea containing block y lo rompe).
- `--kb-inset` es la única fuente fiable para posicionar cosas respecto al
  teclado en iOS.
- No redimensionar el overlay con JS a partir de `visualViewport.height`.
- No usar `scrollIntoView` ni animar el desplazamiento del teclado.

### Modo "campo a pantalla completa" — eliminado
Hubo un `LiveFullscreenLineup` (overlay a pantalla completa del campo en el
partido en vivo). **Se quitó** porque no funcionaba bien en iPhone. No volver a
añadirlo; el campo ya se ve completo en la vista normal del partido.

## Cómo probar cambios de layout en local (sin iPhone)

Chrome externo por CDP a tamaño iPhone, sirviendo con Vite:

1. Crear un harness temporal `__dev.html` + `src/__dev.jsx` que monte `<App>`
   con `window.storage` simulado (`squad`, `boards`, `settings`, `history`) y
   `team`/`user` falsos, para evitar el auth/D1.
2. `npx vite --port 5199 --host 127.0.0.1` y abrir `http://127.0.0.1:5199/__dev.html`.
3. Vía **Chrome DevTools Protocol** (paquete `ws` ya instalado) con
   `Emulation.setDeviceMetricsOverride { width:390, height:844, mobile:true }`:
   - navegar, clickar pestaña/fila, `Page.captureScreenshot`.
   - medir `getBoundingClientRect()` del botón del pie y comprobar
     `bottom <= innerHeight` y, simulando teclado,
     `document.documentElement.style.setProperty('--kb-inset','336px')`.
4. Borrar el harness al terminar (no debe quedar en el repo).

Comprobaciones que deben pasar:
- `sheet.parentElement.parentElement === document.body` (portal OK).
- Sin teclado: botón del pie visible y dentro del viewport.
- Con `--kb-inset=336px`: botón sube ~336px y sigue visible.
- Inputs del sheet inset por igual a ambos lados (no desbordan).

## Base de datos / datos

- Notas de partido: formato `notesLog = [{ id, minute, text }]`; el formato
  antiguo `notes` (string) se migra automáticamente (`migrateMatchNotes`).
- Se corrigió mojibake UTF-8↔CP850 en notas (`repairMojibake`).
- El historial en D1 se migró al nuevo formato de notas.
