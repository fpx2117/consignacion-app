# Goal

Implementar la Fase 4 de KNOWLEDGE,cloud ("lockup tipográfico"): agregar el
header de marca `KNOWLEDGE | CLOUD` a la cabecera del producto (`TopBar`),
y un `title` template de Next.js para el `<title>` del navegador, según la
guía de diseño que dio el usuario en la sesión anterior. La firma
institucional `KNOWLEDGE,cloud` (con coma) no se toca — sigue siendo el
`alt` del logo y el texto que usan los comentarios/tests del sistema de
diseño.

# Done when

- Nuevo componente `src/components/layout/brand-lockup.tsx`: renderiza el
  ícono (`BrandLogo`) + `KNOWLEDGE` (peso medio) + separador de 1px de
  ancho / 16px de alto vía `<span aria-hidden>` con bajo contraste (no el
  carácter `|` literal) + `CLOUD` (azul de marca, `var(--primary)`), con
  espaciado equilibrado a ambos lados del separador.
- `TopBar` (`src/components/layout/top-bar.tsx`) usa `BrandLockup` en el
  espacio vacío del lado izquierdo (hoy sólo tiene un comentario "Logo
  oculto en mobile..." sin JSX) — visible en desktop, oculto en mobile
  (el rail de `SidebarDock` ya es icon-only en mobile, sin espacio para
  texto).
- `src/app/layout.tsx`: `metadata.title` pasa de un string estático a
  `{ default: "Knowledge | Cloud", template: "%s | Knowledge Cloud" }`.
- Se resuelven las colisiones que el template genera en los 2 títulos de
  página existentes (`export const metadata` en `page.tsx`, no toasts):
  - `login/page.tsx`: `title: "Dashboard"` (placeholder incorrecto, ya
    flageado en Fase 3) → `title: "Iniciar sesión"`.
  - `settings/branches/page.tsx`: `title: "Sucursales | Configuración"` →
    `title: "Sucursales"` (el `| Configuración` manual duplicaría el
    template y quedaría `Sucursales | Configuración | Knowledge Cloud`).
- `src/components/layout/brand-logo.tsx`: se retira `showText` de la
  interfaz (prop muerta, nunca se usó — el lockup vive en su propio
  componente, no en `BrandLogo`).
- `npm run visual:check`, `npm run visual:test`, `npx tsc --noEmit` (sin
  errores nuevos) y `npm run build` terminan en verde.
- Smoke visual manual (`playwright-cli`, autenticado, light/dark) confirma
  que el lockup se ve en el `TopBar` de escritorio y que el `<title>` del
  navegador compone correctamente con el template.

# Never touch

- El texto `KNOWLEDGE,cloud` como firma institucional (alt del logo,
  comentarios de `know-design-system.ts`/`external-colors.css`,
  `tailwind-inline.ts`).
- Metadata del storefront público (`lista/page.tsx`, `[slug]/page.tsx`,
  `lista/layout.tsx`) — es el hallazgo documentado en Fase 3, no esta fase.
- Los `title` que son en realidad textos de toasts/cards dentro de
  funciones (ej. `dashboard/page.tsx`, `ventas/nueva/page.tsx`) — no son
  `metadata.title`, no los toca el template.
- Archivos bloqueados por la auditoría (>1000 líneas).

# Stop if

- El template de `title` rompe un título de página que no se puede
  resolver sin tocar un archivo bloqueado por la auditoría.
- El ratchet de `visual-guard` (ninguna línea puede crecer en un archivo
  existente) obliga a un cambio de diseño que se sale del alcance de esta
  fase para poder cerrar.
