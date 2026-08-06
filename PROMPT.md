# Goal

Implementar la Fase 1 de KNOWLEDGE,cloud ("refactor del núcleo"): crear la
fuente canónica de tokens visuales, dividir `globals.css` por responsabilidad,
retirar la duplicación de `color-tokens.ts` y estabilizar los alias de
Tailwind v4. Se aplica la paleta nueva (Cobalto/Profundo/Eléctrico/Pálido/
Carbón/etc.) al `:root` global light/dark en este mismo commit.

# Done when

- Existe `src/theme/know-design-system.ts` (máximo 300 líneas) con:
  primitivos cromáticos, roles semánticos light/dark, colores externos
  autorizados (brand/provider/status/swatch/theme presets/wa/traffic/ui-fx/
  report), y un generador de CSS a partir de esos tokens.
- `globals.css` no contiene valores cromáticos literales fuera de alias
  Tailwind estructurales; los valores light/dark provienen de la fuente
  canónica.
- `globals.css` se divide en `globals.css` (aliases + base, objetivo <150
  líneas), `motion.css` (keyframes/transiciones) y `storefront-theme.css`
  (`.store-theme-root`).
- `src/lib/theme/color-tokens.ts` se elimina; su único consumidor
  (`report-theme.ts`) pasa a usar la fuente canónica.
- `tailwind.config.ts` (config v3 no referenciada por Tailwind v4/PostCSS) se
  elimina.
- Un test verifica que `globals.css`/`storefront-theme.css` no diverjan de
  los valores declarados en `know-design-system.ts`.
- `npm run visual:check`, `npm run visual:test`, `npx tsc --noEmit` (sin
  errores nuevos) y `npm run build` terminan en verde.
- Smoke visual manual en el navegador (light/dark) sin regresiones de
  contraste evidentes.

# Never touch

- Tipografía (Satoshi/Geist) — es Fase 2.
- Marca/logos (`brand-logo.tsx`, favicon, metadata) — es Fase 3.
- Archivos bloqueados por la auditoría (>1000 líneas) no listados como núcleo
  visual.
- Migraciones, schema Prisma, lógica de negocio.

# Stop if

- Hace falta tocar un archivo bloqueado por la auditoría para completar el
  refactor del núcleo.
- El generador de CSS requiere una dependencia nueva.
- Un componente compartido rompe visualmente de forma no resoluble sin salir
  del alcance de "núcleo".
