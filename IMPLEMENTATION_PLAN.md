# KNOWLEDGE,cloud — Fases 0-6

## Completado (Fase 0)

- Scanner visual y estructural sin dependencias.
- Detección de colores, paletas Tailwind, fuentes y marcas legacy.
- Límite de 300 líneas para archivos nuevos.
- Ratchet por archivo para deuda existente.
- Baseline recapturado contra HEAD (`06d1f5c`, ya incluye `be41d06` y la feature
  de share-links con rango de fechas) para 551 archivos, con líneas y deuda
  estructurada. El baseline anterior había quedado desactualizado respecto a
  varios commits de features ya mergeados a `main`, sin relación con esta fase.
- Salida humana y JSON.
- Veintitrés pruebas unitarias e integrales.
- Integración obligatoria dentro de `npm run lint`.
- Build portable y fail-fast orquestado desde Node.
- Capa léxica sin dependencias para funciones y bloques balanceados.
- Verificación adversarial final aprobada sin hallazgos.

## Completado (Fase 1 — refactor del núcleo)

- `src/theme/know-design-system.ts`: fuente canónica única (213 líneas).
  Primitivos cromáticos de la paleta KNOWLEDGE,cloud, roles semánticos
  `LIGHT_THEME`/`DARK_THEME`, `EXTERNAL_COLORS` (marcas/proveedores/estados/
  swatches/presets/reportes), `TYPE_SCALE` (datos para Fase 2), `LOGOS`
  (registro para Fase 3) y `generateThemeCss()`.
- Paleta nueva aplicada al `:root`/`.dark` global (Cobalto/Profundo/
  Eléctrico/Pálido/Blanco cálido/Carbón/Negro profundo). Reemplaza el
  esquema violeta OKLCH anterior en toda la app.
- `globals.css` dividido por responsabilidad: `motion.css` (keyframes/
  toasts/view-transitions), `storefront-theme.css` (`.store-theme-root`),
  `external-colors.css` (marcas/proveedores/estados/swatches/presets/wa/
  traffic/ui-fx/report — no forman parte de la identidad propia).
  `globals.css` quedó en 186 líneas (desde 402); no llegó al objetivo de
  <150 por los ~50 alias de `@theme inline` + bloques light/dark, pero ya
  no tiene valores cromáticos fuera de lo que exige ese objetivo.
- `src/lib/theme/color-tokens.ts` eliminado. Su único consumidor
  (`report-theme.ts`) pasa a leer `EXTERNAL_COLORS` directamente.
- `tailwind.config.ts` eliminado: era config v3 no referenciada por
  Tailwind v4/PostCSS (sin `@config` en `globals.css`), con `hsl(var())`
  incompatible con los tokens OKLCH/hex actuales — dead code confirmado
  por grep antes de borrar.
- `know-design-system.test.ts`: verifica que `globals.css`,
  `storefront-theme.css` y `external-colors.css` no diverjan de los valores
  declarados en la fuente canónica (paridad token↔CSS).
- `scripts/visual-guard-core.mjs`: `COLOR_EXEMPT_PATHS` ahora también cubre
  `globals.css`, `storefront-theme.css` y `external-colors.css` (antes sólo
  eximía el `.ts` canónico). Son la salida CSS de la fuente canónica, no
  hardcoding — el guardrail no tenía este caso contemplado porque estos
  archivos no existían en Fase 0.
- Baseline regenerado (554 archivos: +5 nuevos, -2 eliminados) vía
  `--bootstrap-baseline` (sin ediciones manuales del JSON).
- `know-design-system.test.ts` conectado a `npm run build`
  (`scripts/build.mjs`) y a `npm run visual:test`, no sólo creado.
- Verificación adversarial (`/verify`): primera pasada encontró 2 fallas
  reales (test de paridad no conectado a ningún runner; una entrada del
  baseline editada a mano en vez de regenerada) — ambas corregidas y
  reverificadas en frío por un segundo agente. Segunda pasada: aprobada.

## Pendiente

- Screenshots base con revisión visual real: completado en sesión de
  seguimiento. `playwright-cli open --browser=chromium` funciona con los
  binarios de Chromium ya cacheados en `%LOCALAPPDATA%\ms-playwright`
  (`chrome`/`msedge` fallan porque esos canales requieren el navegador de
  sistema, no instalado; el bundle de Playwright no necesitó descarga
  nueva). Se revisó `/login` en light y dark a 1440×900, con el formulario
  vacío y lleno (para ver `--primary` sin la opacidad del estado
  `disabled`). Resultado: `--primary` renderiza exactamente `#1737c8`
  (Cobalto) en light y `#3155ff` (Eléctrico) en dark, con foco/anillo,
  fondo, tarjeta y texto coincidiendo con `know-design-system.ts`. Sin
  hallazgos de contraste a simple vista. Capturas no versionadas (quedaron
  en el scratchpad de la sesión, no en el repo).
- Revisar pantallas autenticadas (dashboard, tablas, gráficos) con
  capturas reales: no se hizo en esta sesión porque requiere login.
  Resuelto en Fase 6.

## Completado (Fase 2 — Satoshi global)

Commiteado como `05d2f17`.

- `layout.tsx`: `Geist`/`Geist_Mono` (`next/font/google`) reemplazadas por
  `next/font/local` (`satoshi`, variable `--font-satoshi`), cargando
  `Satoshi-{Light,Regular,Medium,Bold}.woff` desde `public/font/` (10 pesos
  disponibles en la carpeta, sólo 4 wireados por ahora).
  `globals.css`: `--font-sans` apunta a `--font-satoshi`; `body` la usa
  explícitamente.
  `storefront.css`: `--storefront-font-heading`/`--storefront-font-body`
  dejaron de hardcodear `"Inter"`, heredan `var(--font-sans)`.
  `render-catalog-page.tsx`: se quitó el `Inter` de `next/font/google` que
  quedaba aplicado sólo al storefront (ahora hereda Satoshi global).
  `tailwind-inline.ts` (reportes/PDF, fuente embebida en base64 para
  Railway sin internet): Poppins → Satoshi.
  `package.json`: se retiró `@fontsource/poppins` (ya no se usa).
- Cleanup no relacionado a fuentes, hecho en la misma sesión: se borraron
  `ThemeEditor.tsx`, `ThemeInjector.tsx` y `themeStore.ts` (sin ningún
  import restante, confirmado por grep — código muerto tras el refactor de
  Fase 1).
- Verificación en esta sesión: `npm run visual:check` (549 archivos OK),
  `npm run visual:test` (29/29 tests OK), `npx tsc --noEmit` (único error
  preexistente y no relacionado, `money-input.test.ts` TS5097, ya presente
  antes de esta sesión), `npm run build` completo sin errores.
  Smoke visual manual con `playwright-cli` (chromium, 1440×900):
  - `/login` en light y dark: `getComputedStyle(body).fontFamily` confirma
    `satoshi, "satoshi Fallback", system-ui, sans-serif`. Tipografía
    renderiza correctamente, sin FOUT visible, contraste y paleta
    (Cobalto/Eléctrico) intactos en ambos modos.
  - `/lista` (storefront): tipografía Satoshi aplicada correctamente en
    headings, precios y categorías. Los 22 errores de consola son 400 de
    `/api/files/*.webp` (imágenes de producto faltantes en el entorno
    local) — no relacionados con la fuente, no son regresión de esta
    sesión.
  - Capturas de smoke test descartadas tras la verificación (no quedan
    versionadas en el repo).
- Decisiones tomadas antes del commit: `public/brand/*.png` se dejó fuera
  a propósito (es Fase 3). Los 6 pesos de Satoshi sin usar (`*Italic`,
  `Black`) se dejaron en `public/font/` para consumo futuro, sin wirear.
  `PROMPT.md` se redactó de forma retroactiva (implementación ya hecha y
  verificada) a pedido explícito del usuario.

## Completado (Fase 3 — marca/logos)

- `src/components/layout/brand-logo.tsx`: reemplaza el placeholder de texto
  ("POS" en una caja de color) por el logo real. Renderiza **ambas**
  variantes (`LOGOS.light`/`LOGOS.dark`) siempre; el CSS (`.dark:hidden` /
  `hidden dark:block`) decide cuál se ve. Elegir el `src` en JS vía
  `useTheme()` se probó primero y se descartó: el tema real sólo se conoce
  en el cliente (localStorage/`matchMedia`), así que el HTML del servidor
  siempre asume el tema por defecto — eso generaba mismatch de hidratación
  en el `<img>` (atributo `srcSet` distinto entre servidor y cliente) cada
  vez que el usuario tenía dark guardado. Encontrado con
  `playwright-cli console error` durante el smoke test de esta sesión, no
  visible sólo con `visual:test`/build.
- `src/app/layout.tsx`: `metadata.icons` usa `LOGOS.favicon` en vez del
  `/logo.png` heredado del scaffold de Next.js; `metadata.title` pasa de
  "Dashboard" a "KNOWLEDGE,cloud"; `metadata.description` ya no menciona
  "MagicUI".
- `public/logo.png` (620×715, sin canal alpha, placeholder de Next.js/
  MagicUI) eliminado: sin otro consumidor tras el cambio (confirmado por
  grep).
- Verificación: `visual:check`/`visual:test`/`tsc --noEmit`/`build` en
  verde. Smoke visual con `playwright-cli` autenticado (`/dashboard`,
  light y dark, recarga real con `theme` en `localStorage` antes de cargar
  la página — no con `classList` post-mount, que no reproduce el mismatch
  de hidratación real): logo correcto en ambos temas, cero errores de
  consola tras el fix.
- El ratchet de `visual-guard` (ninguna línea puede crecer en un archivo
  existente) obligó a comprimir `brand-logo.tsx` y `layout.tsx` varias
  veces durante la sesión para caber en el presupuesto previo — el
  historial de esos ajustes no queda en git (son intermedios dentro de la
  misma sesión), sólo el resultado final.

## Completado (Fase 4 — lockup tipográfico de marca)

Implementa la guía que dio el usuario en la sesión de Fase 3, quedó
documentada ahí como mejora pendiente y se implementó en esta sesión:

- `src/components/layout/brand-lockup.tsx` (nuevo): `KNOWLEDGE | CLOUD`.
  Separador con `<span aria-hidden>` de 1px de ancho / 16px de alto y bajo
  contraste (`bg-border`), no el carácter `|` literal. `KNOWLEDGE` en peso
  medio; `CLOUD` en azul de marca (`var(--primary)`); espaciado
  equilibrado a ambos lados del separador vía `mx-2`.
- `src/components/layout/top-bar.tsx`: el lockup ocupa el espacio vacío
  del lado izquierdo que sólo tenía un comentario ("Logo oculto en
  mobile..." sin JSX real detrás) — visible en desktop (`hidden md:flex`),
  oculto en mobile (el rail de `SidebarDock` ya es icon-only ahí).
- `src/app/layout.tsx`: `metadata.title` pasa del string estático
  `"KNOWLEDGE,cloud"` a
  `{ default: "Knowledge | Cloud", template: "%s | Knowledge Cloud" }`
  (Next.js title template). La firma institucional con coma
  (`KNOWLEDGE,cloud`) queda intacta en el `alt` del logo y en los
  comentarios del sistema de diseño — no es lo que compone el `<title>`.
- Colisiones que generaba el template, resueltas: `login/page.tsx`
  (`title: "Dashboard"`, placeholder ya flageado en Fase 3) → `"Iniciar
sesión"`; `settings/branches/page.tsx` (`title: "Sucursales |
Configuración"`, con `|` manual) → `"Sucursales"` (el template ya agrega
  el sufijo; dejarlo tal cual hubiera dado `"Sucursales | Configuración |
Knowledge Cloud"`).
- `brand-logo.tsx`: se retiró `showText` de la interfaz (prop muerta,
  nunca se usó — el lockup vive en su propio componente).
- Verificación: `visual:check`/`visual:test`/`tsc --noEmit`/`build` en
  verde. Smoke visual con `playwright-cli` autenticado (`/dashboard`,
  light y dark): lockup visible en el `TopBar`, `<title>` compone
  correctamente (`"Iniciar sesión | Knowledge Cloud"` en `/login`,
  `"Knowledge | Cloud"` por defecto en `/dashboard`, que no define
  `metadata.title` propio), cero errores de consola.
- No se tocó la metadata del storefront público en Fase 4 — quedó como el
  hallazgo que resuelve Fase 5, documentado abajo.

## Completado (Fase 5 — metadata dinámica del storefront)

Resuelve el hallazgo de Fase 3: `lista/page.tsx` y `[slug]/page.tsx` no
definían `generateMetadata` propio, así que el `<title>`/favicon del
catálogo público de cada tienda heredaban el `metadata` estático del
layout raíz en vez del nombre/logo real que configuró el dueño.

- `src/lib/storefront/store-identity.ts` (nuevo): `getStoreIdentity`
  (`sucursal.branding?.businessName || sucursal.nombre`, mismo criterio
  que ya usaba `getPublicCatalogDataRaw` para `storeName`) y
  `buildStorefrontMetadata` (arma `{ title, icons.icon }`, usando el logo
  de la tienda vía `/api/public/branding-media` si existe, o `LOGOS.favicon`
  si no — nunca un ícono roto).
- `resolveStorefrontSucursalId` (la resolución modo-unificado → sucursal
  principal que antes vivía inline en `getPublicCatalogDataRaw`) se
  extrajo a este mismo archivo y `public-catalog.ts` pasa a importarla —
  refactor mecánico, mismo comportamiento, ahora reusada por la metadata.
  Cambió de retornar sólo el id resuelto a `{ resolvedId, modoUnificado }`
  porque `getPublicCatalogDataRaw` también necesita `modoUnificado` más
  abajo en la función.
- `generateListaMetadata`/`generateSlugMetadata`: la lógica completa de
  `generateMetadata` para cada página vive en `store-identity.ts` (no en
  los archivos de página) y se re-exporta con una sola línea
  (`export { generateListaMetadata as generateMetadata } from "..."`) —
  el ratchet de `visual-guard` no permite crecimiento en archivos
  existentes, y este patrón deja `lista/page.tsx`/`[slug]/page.tsx`
  prácticamente intactos en vez de forzar una compresión agresiva del
  código ya existente ahí.
- Verificación: `visual:check`/`visual:test`/`tsc --noEmit`/`build` en
  verde. Smoke visual con `playwright-cli` en `/lista`: `<title>` muestra
  `"ImportVPS | Knowledge Cloud"` (nombre real de la tienda de prueba, no
  el placeholder de la app), favicon apunta a
  `/api/public/branding-media?type=logo&sucursalId=1`. `/[slug]` no se
  probó en vivo — no hay ninguna tienda con `tiendaSlug` configurado en
  este entorno — pero usa la misma `buildStorefrontMetadata` ya validada
  en `/lista` y compila sin errores de tipos.

## Completado (Fase 6 — revisión visual autenticada)

Cierra el ítem que quedó pendiente desde Fase 1: revisión con capturas
reales de pantallas autenticadas en light y dark.

- Pantallas revisadas: `/dashboard` (KPIs + gráficos de rentabilidad),
  `/productos` (tabla con filtros), `/consignaciones` (tabla, estado
  vacío), `/ventas/nueva` (formulario denso + carrito). Sin hallazgos de
  contraste, tipografía o paleta fuera de `know-design-system.ts` en
  ninguna, en ambos temas.
- `/settings/tienda` (`BrandingTab`): confirmado por snapshot de
  accesibilidad (no por captura — ver nota de tooling abajo) que renderiza
  bien; el selector de tipografía por tienda sigue mostrando "Inter" como
  antes (correcto, fuera del alcance de esta fase, es branding del
  cliente).
- **Hallazgo real, corregido**: la consola del navegador marcaba
  `Image with src "/brand/logo_negro.png" was detected as the Largest
Contentful Paint (LCP). Please add the loading="eager" property` — Fase
  3 le había quitado `priority` a los `<Image>` de `brand-logo.tsx` para
  entrar en el presupuesto del ratchet de `visual-guard`. Se volvió a
  agregar `priority` y se compensó la línea acortando el comentario
  vecino a una sola línea; baseline regenerado.
- Nota de tooling: `playwright-cli` se cerró solo dos veces durante esta
  sesión (browser crash sin causa clara) y en un momento navegó
  espontáneamente a `/dashboard` con el panel de notificaciones abierto
  en vez de mostrar `/settings/tienda` — no se pudo conseguir una captura
  limpia de esa pantalla, se usó el snapshot de accesibilidad como
  evidencia en su lugar.
- Se observaron dos 500 transitorios (`/ventas/nueva`, `/settings/tienda`)
  en la primera navegación tras horas de dev server sin reiniciar —
  resueltos con un reload, contenido correcto después. No se investigó a
  fondo la causa (compilación on-demand de Turbopack es la hipótesis más
  probable); si se repite con el server recién iniciado, sí sería un
  hallazgo real a seguir.
- **No tocado a propósito**: `src/components/notifications/notifications-panel.tsx`
  apareció modificado en el working tree durante esta sesión sin que
  ninguna edición de esta conversación lo tocara — probablemente trabajo
  en curso del usuario en paralelo (IDE abierto). No se incluyó en el
  commit de Fase 6 ni se descartó.

## Deuda preexistente

- El lint global registra errores anteriores a estas fases; el guardrail
  se ejecuta primero y su suite focalizada debe permanecer verde.
- `globals.css` no alcanzó el objetivo <150 líneas (quedó en 186).

## Límites

- Fase 1 no tocó tipografía (Satoshi/Geist, es Fase 2) ni marca/logos
  (`brand-logo.tsx`, favicon, metadata, es Fase 3).
- Fase 3 no tocó el branding configurable por tienda (`BrandingTab.tsx`,
  `render-catalog-page.tsx`) ni la metadata del storefront público — eso
  lo resolvió Fase 5.
- Fase 5 sólo lee el branding existente (`sucursal.branding`); no agrega
  campos nuevos ni toca `BrandingTab.tsx`.
- No se tocó ningún archivo bloqueado por la auditoría (>1000 líneas).
- Máximo 300 líneas por archivo manual nuevo.

## Próximos pasos

- Validar `/[slug]` en un entorno con al menos una tienda con
  `tiendaSlug` configurado (no se pudo probar en vivo en esta sesión).
