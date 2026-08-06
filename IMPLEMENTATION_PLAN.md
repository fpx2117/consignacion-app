# KNOWLEDGE,cloud — Fase 1

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

## En curso (Fase 2 — Satoshi global)

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
  - Capturas (`fase2-login-light.png`, `fase2-login-dark.png`,
    `fase2-lista.png`) generadas en el repo, sin commitear todavía.
- Sin commitear: todo el trabajo de Fase 2 sigue en el working tree. Hay
  además untracked `public/brand/logo*.png` (Fase 3, marca — no debería ir
  en el commit de Fase 2 salvo decisión explícita en contrario) y
  `public/font/*.woff` (10 pesos Satoshi, de los cuales sólo 4 están
  wireados en `layout.tsx`).
- Pendiente antes de cerrar Fase 2:
  - No existe un `PROMPT.md` específico de Fase 2 en disco — el actual
    sigue siendo el de Fase 1. Falta correr `/spec` o redactarlo a mano
    antes de dar la fase por cerrada, según el contrato de loopkit.
  - Decidir si `public/brand/*.png` se separa a un commit de Fase 3 o se
    incluye igual (está fuera del alcance declarado de Fase 2).
  - Decidir si los 6 pesos de Satoshi no usados (`*Italic`, `Black`) se
    eliminan de `public/font/` o se dejan para consumo futuro.
- Iniciar Fase 3 (marca/logos) en una sesión separada, una vez cerrada y
  commiteada la Fase 2.

## Deuda preexistente

- El lint global registra errores anteriores a estas fases; el guardrail
  se ejecuta primero y su suite focalizada debe permanecer verde.
- `globals.css` no alcanzó el objetivo <150 líneas (quedó en 186).

## Límites

- Fase 1 no tocó tipografía (Satoshi/Geist, es Fase 2) ni marca/logos
  (`brand-logo.tsx`, favicon, metadata, es Fase 3).
- No se tocó ningún archivo bloqueado por la auditoría (>1000 líneas).
- Máximo 300 líneas por archivo manual nuevo.
