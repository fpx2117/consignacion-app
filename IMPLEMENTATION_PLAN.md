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

- Screenshots base con revisión visual real en navegador: no se pudo
  completar en esta sesión (Playwright no tiene ningún browser instalado
  en este entorno — `chrome`/`msedge` fallan, la descarga con `npx
playwright install` no bajó binarios). Verificado en su lugar con: tests
  de paridad token↔CSS, `next build` exitoso, y razonamiento de contraste
  al definir cada rol (ver tabla de la paleta en el plan). Recomendado:
  correr `npm run visual:baseline`-equivalente visual (captura de pantalla
  real) apenas haya un browser disponible, antes de avanzar a Fase 5+.
- Iniciar Fase 2 (Satoshi global) en una sesión separada.

## Deuda preexistente

- El lint global registra errores anteriores a estas fases; el guardrail
  se ejecuta primero y su suite focalizada debe permanecer verde.
- `globals.css` no alcanzó el objetivo <150 líneas (quedó en 186).

## Límites

- Fase 1 no tocó tipografía (Satoshi/Geist, es Fase 2) ni marca/logos
  (`brand-logo.tsx`, favicon, metadata, es Fase 3).
- No se tocó ningún archivo bloqueado por la auditoría (>1000 líneas).
- Máximo 300 líneas por archivo manual nuevo.
