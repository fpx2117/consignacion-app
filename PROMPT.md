# Goal

Implementar la Fase 3 de KNOWLEDGE,cloud ("marca/logos"): reemplazar el
placeholder de `BrandLogo` (caja "POS") y el favicon/metadata heredados del
scaffold (MagicUI/"Dashboard") por los assets reales de marca ya
registrados en `LOGOS` (`src/theme/know-design-system.ts`, preparado en
Fase 1) desde `public/brand/`.

# Done when

- `src/components/layout/brand-logo.tsx` renderiza el logo real
  (`LOGOS.light`/`LOGOS.dark` según el tema activo) en vez del placeholder
  de texto "POS".
- `src/app/layout.tsx`: `metadata.icons` usa `LOGOS.favicon` en vez del
  `/logo.png` heredado del scaffold de Next.js; `metadata.title` es
  "KNOWLEDGE,cloud" y `metadata.description` ya no menciona "MagicUI".
- `public/logo.png` (620×715, sin canal alpha, placeholder de Next.js/
  MagicUI) se elimina si queda sin otro consumidor tras el cambio.
- `npm run visual:check`, `npm run visual:test` y `npm run build` terminan
  en verde.
- Smoke visual manual (`playwright-cli`, light/dark) confirma que el logo
  se ve correctamente en el sidebar y que el favicon carga sin errores de
  red.

# Never touch

- Tipografía (ya cerrado en Fase 2).
- El selector de tipografía/logo configurable por tienda
  (`BrandingTab.tsx`, branding del storefront de cada cliente) — es
  personalización por tienda, no la identidad propia de la app.
- `LOGOS.print` (`report-theme.ts` / reportes PDF) — no forma parte del
  alcance de esta fase salvo que romper la carga de `logo.png` lo requiera.
- Archivos bloqueados por la auditoría (>1000 líneas) no listados como
  núcleo de marca.
- Migraciones, schema Prisma, lógica de negocio.

# Stop if

- Los assets de `public/brand/` no alcanzan (falta un tamaño, formato o
  variante necesaria) y hace falta generar arte nuevo.
- El cambio de favicon/logo requiere tocar el branding configurable por
  tienda del storefront.
- Un componente compartido rompe visualmente de forma no resoluble sin
  salir del alcance de "marca".
