# KNOWLEDGE,cloud — Fases 0-3

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
- Falta revisar pantallas autenticadas (dashboard, tablas, gráficos) con
  capturas reales — no se hizo en esta sesión porque requiere login: queda
  para cuando la Fase 5 (módulos protegidos) las toque directamente.

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

### Mejora documentada (no implementada): lockup tipográfico de marca

El usuario pidió registrar esto como mejora para una sesión futura, no
implementarlo ahora:

- Reemplazar la coma en "KNOWLEDGE,cloud" por una barra vertical fina y de
  bajo contraste como separador, en vez del carácter `|` literal (mejor
  control de alto/color/espaciado con un `<span>` de 1px de ancho).
- Jerarquía tipográfica en el lockup: `KNOWLEDGE` en peso medio,
  `CLOUD` en azul de marca o gris claro, barra separadora fina gris tenue,
  espaciado equilibrado a ambos lados.
- La identidad queda en tres capas distintas según el contexto:
  - Firma institucional (fuera del producto, ej. legal/emails): `KNOWLEDGE,cloud`.
  - Cabecera del SaaS (dentro del producto): `KNOWLEDGE | CLOUD`.
  - Título del navegador (`<title>`): `Knowledge | Cloud`, con
    `title: { default: "Knowledge | Cloud", template: "%s | Knowledge Cloud" }`
    en `metadata` (Next.js title template) en vez del string estático
    actual.
- No se tocó nada de esto en Fase 3: `metadata.title` sigue siendo el
  string estático `"KNOWLEDGE,cloud"` (la firma institucional), no el
  template. Cambiarlo a template affecta cómo cada página hija compone su
  `<title>` (varias ya definen su propio `metadata.title`, ej. `/login` →
  "Dashboard" — ese valor también debería revisarse en esa misma sesión).

### Hallazgo (no corregido): metadata del storefront hereda la del layout raíz

Detectado al investigar el pedido del usuario sobre el logo de tienda:
`src/app/lista/page.tsx` y `src/app/[slug]/page.tsx` (las páginas públicas
del catálogo/storefront) no definen `generateMetadata`/`export const
metadata` propio. Como consecuencia, el `<title>` del navegador y el
favicon del catálogo público de cada tienda heredan el `metadata` estático
del layout raíz (`"KNOWLEDGE,cloud"` / `LOGOS.favicon`) en vez de reflejar
el nombre y logo reales de la tienda que el dueño configuró.

El logo visual del catálogo sí es correcto: `render-catalog-page.tsx` ya
sirve el logo subido por el usuario vía
`/api/public/branding-media?type=logo&sucursalId=...` (por eso el logo que
se ve en `/lista` es el de la tienda, no el de `LOGOS`). El gap es
específicamente la metadata del `<head>` (title/favicon), no el logo
visible en la página.

Fix pendiente (fuera de alcance de Fase 3, que es la identidad _propia_ de
la app, no el branding configurable por tienda): agregar
`generateMetadata` a `lista/page.tsx` y `[slug]/page.tsx` que resuelva el
nombre de la tienda (vía la misma fuente que ya usa
`branding-media`/`getTiendaGlobalConfig`) para `title`, y el logo de la
tienda para `icons.icon`.

## Deuda preexistente

- El lint global registra errores anteriores a estas fases; el guardrail
  se ejecuta primero y su suite focalizada debe permanecer verde.
- `globals.css` no alcanzó el objetivo <150 líneas (quedó en 186).

## Límites

- Fase 1 no tocó tipografía (Satoshi/Geist, es Fase 2) ni marca/logos
  (`brand-logo.tsx`, favicon, metadata, es Fase 3).
- Fase 3 no tocó el branding configurable por tienda (`BrandingTab.tsx`,
  `render-catalog-page.tsx`) ni la metadata del storefront público (ver
  hallazgo arriba) — es identidad _propia_ de la app, no del cliente.
- No se tocó ningún archivo bloqueado por la auditoría (>1000 líneas).
- Máximo 300 líneas por archivo manual nuevo.

## Próximos pasos

- Fase 4 (si aplica): resolver el hallazgo de metadata dinámica del
  storefront (`generateMetadata` en `lista/page.tsx` y `[slug]/page.tsx`).
- Sesión aparte: aplicar el lockup tipográfico `KNOWLEDGE | CLOUD`
  documentado arriba (cabecera del SaaS + `title` template del navegador),
  sin tocar la firma institucional `KNOWLEDGE,cloud`.
