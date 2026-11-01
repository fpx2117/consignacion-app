# POS Responsive Layout Correction
Objective: make `/ventas/nueva` usable across mobile, tablet, desktop, short viewports, zoom, and orientation changes without redesigning components or changing business behavior.
Branch: `fix/pos-responsive-layout` · Delivery: `ask-on-risk` · Forecast: ~260 authored lines · Runners: focused UI/browser checks, `npm run visual:check`, `npm run visual:test`, `npm run lint`, and `npm run build`.

## Specs

- **S1 — Audit before implementation.** “No asumas las causas sin inspeccionar el código.” Identify fixed dimensions, flex/grid/overflow/scroll/positioning issues, product-versus-summary proportions, empty space, compressed elements, controls outside the viewport, shell/header/footer conflicts, ticket growth behavior, and mobile interaction problems.
- **S2 — Responsive reference surface.** Verify “Mobile: 320, 360, 375, 390 y 430 px”, “Tablet: 768 y 1024 px”, “Desktop: 1280, 1440 y 1920 px”, and “Ventanas de poca altura: 568 y 600 px”. Adjust by content needs rather than device-specific media-query patches; account for landscape/portrait, resizing, browser zoom, and mobile safe areas.
- **S3 — POS states and interactions.** Verify “Ticket vacío”, “Un producto agregado”, “Múltiples productos agregados”, “Nombres de productos extensos”, “Cambios de cantidades”, “Precios y totales grandes”, “Uso del buscador, escáner y cámara”, “Selección de métodos de pago”, and “Apertura de modales y elementos interactivos existentes”. Product list, summary, and payment actions must remain visible and accessible for the available space.
- **S4 — Mobile usability.** “En mobile, priorizá la operación de venta sin provocar desplazamiento horizontal, superposición de elementos, cortes de contenido o controles inaccesibles.”
- **S5 — Preserve visual and business contracts.** “No rediseñar componentes.” Do not modify colors, typography, iconography, identity, commercial logic, calculations, sales state, permissions, integrations, or current functionality. Reuse existing structures/styles/conventions and make only minimal structural adjustments when indispensable.
- **S6 — Evidence and delivery.** “Primero identificá las causas y establecé una estrategia de adaptación. Después implementá los cambios dentro del alcance autorizado.” Run available tests and browser checks, report only executed verification, and deliver problems found, modified files, corrections, and resolutions actually verified.

## Tasks

- [x] **T1** — Audit current POS flow and dirty worktree; link S1, S5. Route: delegated read-only mapping (mapping trigger). Evidence: duplicate viewport sizing, nested scroll regions, fixed 380px summary, short-height pressure, content-overflow and touch-target risks identified; pre-existing POS diff captured.
- [x] **T2** — Correct viewport ownership, responsive product/summary distribution, and scroll containment; link S2, S4, S5. Route: inline (single behavior with overlapping edit surfaces; no writer trigger). Evidence: POS height now derives from shell space, scroll ownership is bounded, tablets retain the bottom payment surface, and desktop summary width is fluid. Commit: current work-unit commit.
- [x] **T3** — Harden long names, large totals, controls, modals, and short-height/safe-area behavior without changing functionality; link S3-S5. Route: inline (depends on T2 and shares files; no writer trigger). Evidence: constrained names/totals, larger cart targets, short-height compaction, safe-area padding, bounded dialogs, and POS-only camera viewport mode compile and lint. Commit: current work-unit commit.
- [ ] **T5** — Incorporate direct mobile-item, camera-sheet, and desktop-shell feedback; link S4-S6. Route: inline (same responsive behavior and overlapping edit surfaces; no writer trigger). Status: implementation complete; authenticated visual verification remains part of T4.
- [ ] **T6** — Contain multiple animated cart items within the mobile viewport; link S3-S6. Route: inline (same cart layout behavior; no writer trigger). Status: implementation complete; authenticated visual reproduction remains blocked under T4.
- [ ] **T7** — Rebuild the cart item with deterministic rows after T6 failed with four distinct products; link S3-S6. Route: inline (single component behavior and its list wrapper; no writer trigger). Status: implementation complete; awaiting the user's authenticated device retest under T4.
- [ ] **T4** — Run focused browser matrix, interactions, accessibility checks, and repository checks; link S2, S3, S6. Route: inline verification. Status: **Needs your decision** — browser reached `/login` because no authenticated test session is available, so no POS resolution/state matrix can be claimed.

## Log

### L1 — Original request (2026-10-31)

Quiero realizar una **corrección integral del layout y comportamiento responsive del módulo Punto de Venta (POS)**, manteniendo intacto su diseño visual actual.

## Objetivo

Conseguir que el POS se adapte correctamente a diferentes resoluciones, tamaños de ventana y dispositivos, incluyendo computadoras de escritorio, notebooks, tablets y teléfonos móviles.

**No quiero un rediseño de componentes.** Quiero corregir cómo se distribuyen, dimensionan, alinean y adaptan los elementos existentes.

## 1. Auditoría inicial

Explorá la implementación actual del POS e identificá:

- Anchos y alturas fijas que dificultan la adaptación.
- Problemas de flexbox, grid, overflow, scroll y posicionamiento.
- Desproporciones entre el área de productos y el resumen de compra.
- Espacios vacíos excesivos y elementos comprimidos.
- Controles que quedan fuera del viewport, especialmente en pantallas de poca altura.
- Problemas con las barras laterales, encabezados y acciones inferiores.
- Errores responsive al agregar productos, modificar cantidades o aumentar el tamaño del ticket.
- Problemas específicos de visualización e interacción en dispositivos móviles.

No asumas las causas sin inspeccionar el código.

## 2. Adaptación responsive

Asegurá un funcionamiento coherente en los siguientes tamaños de referencia:

- Mobile: 320, 360, 375, 390 y 430 px.
- Tablet: 768 y 1024 px.
- Desktop: 1280, 1440 y 1920 px.
- Ventanas de poca altura: 568 y 600 px.

No te limites a crear media queries para esas medidas. Definí los ajustes según las necesidades reales del contenido.

Considerá también orientación horizontal y vertical, redimensionamiento de ventanas, zoom del navegador y áreas seguras de dispositivos móviles.

## 3. Comportamiento del POS

Verificá los siguientes estados:

- Ticket vacío.
- Un producto agregado.
- Múltiples productos agregados.
- Nombres de productos extensos.
- Cambios de cantidades.
- Precios y totales grandes.
- Uso del buscador, escáner y cámara.
- Selección de métodos de pago.
- Apertura de modales y elementos interactivos existentes.

El listado de productos, el resumen y las acciones de pago deben permanecer correctamente distribuidos, visibles y accesibles según el espacio disponible.

En mobile, priorizá la operación de venta sin provocar desplazamiento horizontal, superposición de elementos, cortes de contenido o controles inaccesibles.

## 4. Restricciones obligatorias

- No rediseñar componentes.
- No modificar colores, tipografías, iconografía ni identidad visual.
- No crear componentes nuevos salvo necesidad técnica justificada y autorizada.
- No modificar lógica comercial, cálculos, estados de venta, permisos ni integraciones.
- No alterar las funcionalidades actuales del POS.
- Reutilizar las estructuras, estilos y convenciones existentes.
- Priorizar correcciones de layout, estilos y clases responsive.
- Realizar solamente ajustes mínimos de estructura cuando sean indispensables.

## 5. Implementación y validación

Utilizá el flujo de trabajo de Gentle-AI para inspeccionar, planificar, implementar y verificar las correcciones.

Primero identificá las causas y establecé una estrategia de adaptación. Después implementá los cambios dentro del alcance autorizado.

Verificá diferentes resoluciones y estados del ticket, prestando especial atención a la experiencia móvil.

Ejecutá las pruebas disponibles y, si existen herramientas de navegador, comprobá visualmente los resultados. No declares comprobaciones que no hayas ejecutado.

## Resultado esperado

Un POS visualmente consistente, equilibrado y completamente utilizable en diferentes dispositivos, conservando sus componentes y su identidad actual.

Entregá un resumen de los problemas encontrados, los archivos modificados, las correcciones realizadas y las resoluciones efectivamente verificadas. /ventas/nueva

### L2 — Audit evidence (2026-10-31)

- The protected shell already reserves top, bottom, sidebar, and page padding while the POS declares its own full `100dvh`, producing an oversized nested viewport.
- Cart, outer page, and desktop summary can all scroll independently; short heights make payment actions compete with fixed headers and navigation.
- The desktop summary is fixed at 380px from `lg`, while content extremes lack sufficient width constraints.
- Existing uncommitted changes in `cart-list.tsx`, `desktop-summary.tsx`, and `mobile-summary-bar.tsx` predate this task and must be preserved.
- No authenticated POS fixtures or UI/E2E tests were found; runtime verification requires the existing local environment and an authenticated session.

### L3 — Implementation evidence (2026-10-31)

- Replaced nested `100dvh` ownership with shell-relative `dvh` heights and explicit `min-h-0`/`min-w-0` containment.
- Moved the persistent desktop summary to `xl`, made its width fluid with `clamp()`, and kept the existing payment bar for mobile/tablet widths.
- Added short-height compaction at 600px, safe-area padding, overscroll containment, content truncation/wrapping, larger cart controls, and viewport-bounded search/customer dialogs.
- Added an optional `constrainToViewport` layout prop to the shared camera sheet and enabled it only from `/ventas/nueva`; existing product flows retain their previous rendering.
- Preserved all existing commercial handlers, calculations, state, permissions, and integrations. Risk: none.

### L4 — Verification evidence and blockers (2026-10-31)

- Focused ESLint for all changed components passed. POS page passed with only the two known pre-existing React compiler rules disabled for that command; the unchanged full-page violations are at `page.tsx:314`, `:333`, `:522`, and `:597`.
- `npm run visual:test`: 29/29 passed.
- POS visual-guard regressions were eliminated. `npm run visual:check` and `npm run lint` remain blocked only by pre-existing unrelated dirty files: `scripts/corregir-perfumes.ts`, `productos-view.tsx`, and `rubro-atributos{,.test}.ts`.
- `npx next build` compiled Next/Tailwind successfully, then stopped on the unrelated pre-existing TypeScript error at `scripts/corregir-datos-catalogo.ts:100` (`number | null` passed to `Map.get(number)`).
- `npx tsc --noEmit` stopped on the same unrelated script at lines 100 and 122.
- Playwright navigated to `/ventas/nueva` at 320×568 but was redirected to `/login`; no credentials or authenticated fixture are available, and the dev server reported Prisma `P1000` database authentication failures. Therefore none of the requested POS resolutions or ticket/payment/modal states are recorded as visually verified.
- React Doctor was not locally installed; no remote package installation was authorized, so that optional scan was not executed.
- Native assessment: `medium`, `under_budget`; its reason was the unrelated executable change `scripts/corregir-perfumes.ts`, and no review lifecycle was due.

### L5 — Direct visual feedback (2026-10-31)

“en el dispositivo se ve raro el item, no tengas en cuenta lo de la imagen, eso ahora no interesa.

y el barcode-camera esa \"consola\" de informacion, para el usuario es completamente inutil.

y te paso esta imagen por que esta rara, el corte que hace entre el punto de venta y el navbar que esta hacia la izquierda, es como que son dos pantallas diferentes, no se ve integrado.”

- Preserve the product image behavior; only reorganize the compressed mobile item controls and subtotal.
- Remove the temporary camera debug state, logging calls, and visible debug panel completely.
- Make the POS fill the protected shell's desktop content area up to the sidebar and top bar without changing other routes.

### L6 — Direct-feedback implementation and checks (2026-10-31)

- The cart item's mobile subtotal now occupies its own full-width row, leaving the quantity stepper and explicit delete action uncompressed; `sm` and wider retain the existing single-row arrangement. Product image behavior was not changed.
- Removed all temporary camera debug state, logging callbacks/calls, and the visible debug panel. User-facing error and status messages remain unchanged.
- The three POS root states now offset only the protected shell's desktop padding and fill the area from the top bar to the viewport bottom, closing the visual gap to the sidebar without changing the shared layout or sidebar on other routes.
- Test-first exception: these are static layout/debug-UI removals with no existing component or authenticated browser harness capable of a meaningful deterministic RED; verification used focused lint, structural inspection, visual-guard tests, and compilation instead.
- Focused ESLint passed for the cart item and camera sheet. The POS page passed with its four known pre-existing React Compiler rules disabled for that file only.
- `npm run visual:test`: 29/29 passed after the final source edit.
- POS files introduce no visual-guard regression. `npm run visual:check` remains blocked only by the same unrelated dirty files (`scripts/corregir-perfumes.ts`, `productos-view.tsx`, and `rubro-atributos{,.test}.ts`).
- `npx next build` compiled Next/Tailwind successfully, then stopped at the unchanged external TypeScript error in `scripts/corregir-datos-catalogo.ts:100` (`number | null` passed to `Map.get(number)`).
- Authenticated browser verification remains blocked by the existing database/session problem, so the three visual corrections are not claimed as visually verified.

### L7 — Multiple mobile cart items overflow (2026-10-31)

“cuando agrego mas de un producto en mobile, se rompe la resolucion con los productos \"en el carrito\"”

- The screenshot shows the cart cards extending past the mobile viewport after a second animated item is mounted.
- The animated list wrapper, card root, and first content row do not all establish explicit `min-width: 0`/full-width containment, allowing descendant min-content width to enlarge the list.
- The subtotal also allows wrapping at the currency separator, which can leave the currency symbol isolated at the right edge.

### L8 — Multiple-item containment implementation and checks (2026-10-31)

- Added explicit full-width, `min-width: 0`, and maximum-width containment to the cart list, every animated item wrapper, each card root, and the card's first flex row.
- Clipped only horizontal animation overflow at the list boundary without creating another scroll container.
- Kept the subtotal on one line so the currency symbol cannot split from its amount.
- No business handlers, product data, images, calculations, or animation behavior were changed.
- Focused ESLint passed for `cart-list.tsx` and `cart-item-card.tsx`; `npm run visual:test` passed 29/29.
- The POS introduces no visual-guard regression. The global guard remains blocked only by the same unrelated dirty files.
- Next/Tailwind compiled successfully; type checking still stops at the unrelated existing error in `scripts/corregir-datos-catalogo.ts:100`.
- Runtime confirmation with multiple authenticated products is still unavailable in this environment, so the screenshot symptom is not claimed as visually verified here.

### L9 — T6 rejected by real-device evidence (2026-10-31)

“pero ahora agregue 4 productos distitos y hace lo mismo, te recomiendo que puedas generar el cart item, lo hagas desde cero contemplando todo esto”

- The user's four-product test is accepted as evidence that width containment alone did not fix the runtime failure.
- Replace the mobile flex-wrap/order composition with deterministic card rows that never derive the card width from product text, totals, or controls.
- Remove Motion layout projection from the list so mounting several items cannot reuse projected dimensions; preserve only entrance/exit feedback.
- Keep the existing component API, product image behavior, calculations, quantity dialog, handlers, semantics, colors, typography, and icons.

### L10 — Deterministic cart-item rebuild and checks (2026-10-31)

- Rebuilt `CartItemCard` around three deterministic regions: product identity, subtotal, and quantity/delete controls. Product text and totals live in explicit `minmax(0, 1fr)`/`min-width: 0` tracks and cannot determine card width.
- Removed the previous mobile `flex-wrap`/responsive order rules entirely.
- Removed Motion `layout` projection and `popLayout` mode from `CartList`; entry and exit feedback remains, but adding products no longer projects measured card dimensions.
- Preserved the component props, product image, discount display, subtotal calculation, quantity/remove behavior, manual quantity dialog, icons, semantic buttons, and accessible labels.
- No meaningful deterministic RED is available without the authenticated browser flow; the user's failed four-product device test is the runtime reproduction evidence. No source-contract test was added because it would only assert implementation class names rather than observable layout.
- Focused ESLint and `git diff --check` passed. `npm run visual:test` passed 29/29, and POS files add no visual-guard regression.
- Next/Tailwind compiled successfully; type checking remains blocked by the unrelated existing error in `scripts/corregir-datos-catalogo.ts:100`.
- The rebuilt item is not claimed as visually verified until the authenticated device case is rerun.

### L11 — Delivery authorization (2026-10-31)

“ahora generame el commit y el push sobre estas modificaciones”

- The user explicitly authorized commit and push while T4/T7 visual confirmation remains pending.
- The user chose to exclude pre-existing overlapping edits from `cart-list.tsx`, `desktop-summary.tsx`, and `mobile-summary-bar.tsx`; only attributable hunks may enter the commit.
