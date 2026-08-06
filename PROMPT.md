# Goal

Implementar la Fase 5 de KNOWLEDGE,cloud ("metadata dinámica del
storefront"): el `<title>` y el favicon del catálogo público de cada
tienda (`/lista`, `/[slug]`) deben reflejar el nombre y el logo reales que
el dueño configuró, en vez de heredar el `metadata` estático del layout
raíz (`"Knowledge | Cloud"` / `LOGOS.favicon`). Es el hallazgo documentado
en Fase 3.

# Done when

- Nuevo helper server-only (`src/lib/storefront/store-identity.ts` o
  similar) que resuelve, a partir de un `sucursalId`, el nombre a mostrar
  (`sucursal.branding?.businessName || sucursal.nombre`, mismo criterio
  que ya usa `getPublicCatalogDataRaw` para `storeName`) y si esa sucursal
  tiene logo propio cargado (`branding.logoData`).
- La resolución de `sucursalId` en modo unificado (sucursal principal si
  `modoUnificado`, igual que hace hoy `getPublicCatalogDataRaw`) se
  extrae a una función compartida en vez de duplicarse — `public-catalog.ts`
  pasa a usarla también, no sólo el nuevo código.
- `src/app/lista/page.tsx` y `src/app/[slug]/page.tsx` exportan
  `generateMetadata`:
  - `title`: nombre de la tienda (compone con el template del layout raíz:
    `"<Nombre tienda> | Knowledge Cloud"`).
  - `icons.icon`: `/api/public/branding-media?type=logo&sucursalId=...` si
    la tienda tiene logo propio cargado; si no, cae a `LOGOS.favicon` (el
    de la app) — nunca un ícono roto.
- `src/app/lista/layout.tsx` (`title: "Catálogo online"` estático) se
  revisa: si `generateMetadata` en `page.tsx` ya cubre el título real, el
  título del layout queda sólo como fallback antes de que resuelva la
  promesa — confirmar que no compite/pisa el de la página.
- `npm run visual:check`, `npm run visual:test`, `npx tsc --noEmit` (sin
  errores nuevos) y `npm run build` terminan en verde.
- Smoke visual manual (`playwright-cli`) en `/lista` confirma que el
  `<title>` del navegador muestra el nombre real de la tienda de prueba
  (no "Knowledge | Cloud" ni "Catálogo online").

# Never touch

- El logo _visible en la página_ del catálogo (`render-catalog-page.tsx`)
  — ya usa el logo de marca correcto, no es parte de este hallazgo.
- Identidad propia de la app (`layout.tsx` raíz, `BrandLogo`,
  `BrandLockup`) — esta fase es sobre el branding _del cliente_, no el de
  KNOWLEDGE,cloud.
- El branding configurable por tienda (`BrandingTab.tsx`) — sólo se lee,
  no se agrega ningún campo nuevo.
- Archivos bloqueados por la auditoría (>1000 líneas).

# Stop if

- Resolver el nombre/logo real requiere una consulta tan pesada como
  `getPublicCatalogDataRaw` completo (productos, banners) — en ese caso
  frenar y decidir con el usuario si vale la pena el costo extra por
  request o si hay que cachear.
- El refactor de `resolveStorefrontSucursalId` cambia el comportamiento
  observable de `getPublicCatalogDataRaw` (debe ser un movimiento
  mecánico, no un cambio de lógica).
