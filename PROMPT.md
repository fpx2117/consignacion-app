# Goal

Implementar la Fase 2 de KNOWLEDGE,cloud ("Satoshi global"): reemplazar las
fuentes heredadas (Geist en la app, Inter en el storefront, Poppins en los
reportes/PDF) por Satoshi como fuente única de la identidad, servida como
`next/font/local` desde `public/font/` sin dependencia de Google Fonts ni de
paquetes npm de fuentes.

# Done when

- `src/app/layout.tsx` carga Satoshi vía `next/font/local` (pesos
  Light/Regular/Medium/Bold) en la variable `--font-satoshi`, en vez de
  `Geist`/`Geist_Mono` de `next/font/google`.
- `globals.css` define `--font-sans: var(--font-satoshi), system-ui,
sans-serif` y `body` la usa explícitamente.
- `storefront.css` (`.store-theme-root`) hereda `var(--font-sans)` en vez de
  hardcodear `"Inter"`.
- `render-catalog-page.tsx` deja de instanciar `Inter` vía
  `next/font/google`; el storefront hereda la fuente global.
- Los reportes/PDF (`tailwind-inline.ts`, fuente embebida en base64 para
  funcionar en Railway sin acceso a internet) usan Satoshi en vez de
  Poppins.
- Se retira `@fontsource/poppins` de `package.json` (dependencia sin otro
  consumidor).
- `npm run visual:check`, `npm run visual:test` y `npm run build` terminan
  en verde.
- Smoke visual manual (`playwright-cli`, light/dark) en `/login` y `/lista`
  confirma que `getComputedStyle(body).fontFamily` resuelve a Satoshi y que
  no hay regresiones visuales evidentes.

# Never touch

- Marca/logos (`brand-logo.tsx`, favicon, metadata, `public/brand/`) — es
  Fase 3.
- El selector de tipografía configurable del storefront por tienda
  (`BrandingTab.tsx`, opciones "Inter"/"Poppins"/etc.) — es una feature de
  personalización por cliente, no la identidad visual propia de la app; no
  se cambia en esta fase.
- Archivos bloqueados por la auditoría (>1000 líneas) no listados como
  núcleo de tipografía.
- Migraciones, schema Prisma, lógica de negocio.

# Stop if

- Hace falta tocar `public/brand/` o cualquier asset de marca para que la
  tipografía funcione.
- El cambio de fuente requiere modificar el selector de tipografía por
  tienda (`BrandingTab.tsx`) para que siga funcionando.
- Un componente compartido rompe visualmente de forma no resoluble sin
  salir del alcance de "tipografía".

# Notas (retroactivo)

Este documento se redactó después de implementar y verificar la fase (no
antes, como pide el flujo normal de `/spec`), a pedido explícito del
usuario, para dejar registro del contrato antes de commitear. El detalle de
lo verificado en esta sesión (tests, build, smoke visual) está en
`IMPLEMENTATION_PLAN.md`, sección "En curso (Fase 2 — Satoshi global)".
`public/font/` incluye 10 pesos de Satoshi; sólo 4 (Light/Regular/Medium/
Bold) están wireados en `layout.tsx`. Los 6 restantes (itálicas y Black)
quedan en el repo sin usar, disponibles para cuando se necesiten.
