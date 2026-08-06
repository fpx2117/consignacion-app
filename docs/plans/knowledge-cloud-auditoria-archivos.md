# Auditoría de archivos para identidad KNOWLEDGE,cloud

## Estado

Auditoría read-only realizada antes de implementar el plan visual.

## Objetivo

Identificar los archivos que deberán cambiar, detectar responsabilidades mezcladas y bloquear la edición de archivos sobredimensionados hasta que sean divididos de forma segura.

## Resultado general

| Métrica                                               | Cantidad |
| ----------------------------------------------------- | -------: |
| Archivos productivos `.ts`, `.tsx` y `.css` auditados |      527 |
| Archivos de más de 300 líneas                         |       95 |
| Archivos de más de 500 líneas                         |       35 |
| Archivos de más de 800 líneas                         |       14 |
| Archivos de más de 1000 líneas                        |       11 |
| Archivos grandes relevantes para la migración visual  |       67 |

La deuda principal está en controladores React que también contienen presentación desktop/mobile, formularios, llamadas remotas y reglas de negocio.

## Política estricta de tamaño

| Regla                     |                         Límite |
| ------------------------- | -----------------------------: |
| Archivo productivo manual |              300 líneas máximo |
| Advertencia preventiva    |                     250 líneas |
| Componente o función      |              120 líneas máximo |
| Página o route shell      |            150 líneas objetivo |
| Hook o controller         |            200 líneas objetivo |
| Archivo nuevo             | Nunca puede superar 300 líneas |

Reglas complementarias:

- Un archivo relevante que supere 300 líneas debe dividirse antes de aplicar cambios visuales.
- Un archivo grande existente no puede crecer mientras mantenga una excepción temporal.
- Una modificación de más de 25 líneas en un archivo grande obliga a extraer responsabilidades.
- Ningún archivo se divide en microarchivos sin responsabilidad propia.
- No se crean helpers de una sola línea ni abstracciones con un único consumidor sin necesidad real.
- Cada extracción debe reducir acoplamiento, no mover JSX sin contrato.
- Los archivos generados, migraciones inmutables y schema pueden tener una excepción documentada.
- Una excepción debe incluir motivo, límite actual, responsable y fecha de eliminación.

## Bloqueadores de más de 1000 líneas

Estos archivos no pueden recibir cambios visuales antes de ser divididos.

| Archivo                                                   | Líneas | Acción previa obligatoria                                                     |
| --------------------------------------------------------- | -----: | ----------------------------------------------------------------------------- |
| `productos/components/factura-proveedor-dialog.tsx`       |   2045 | Separar controller, polling, upload, metadata, toolbar, filas y preview       |
| `productos/components/productos-view.tsx`                 |   1793 | Separar controller, selectors, stats, tabla, mobile cards y acciones          |
| `pedidos-esperados/components/pedidos-esperados-view.tsx` |   1330 | Separar controller, stats, filas, cards y detalle                             |
| `app/lista/catalog-client.tsx`                            |   1254 | Separar carrito persistido, checkout, selectors, navegación y contenido       |
| `productos/components/producto-wizard-dialog.tsx`         |   1247 | Separar controller, adapter, steps y navegación                               |
| `ventas/nueva/page.tsx`                                   |   1141 | Separar controller, shortcuts, pricing, checkout y shells responsive          |
| `settings/pos/page.tsx`                                   |   1063 | Separar carga, caja, operación, precios y pagos                               |
| `settings/tienda/page.tsx`                                |   1050 | Separar editor state, uploads, dirty guard, tabs y preview                    |
| `gastos/page.tsx`                                         |   1019 | Separar controller y tres diálogos de dominio                                 |
| `src/lib/types.ts`                                        |   1078 | No mezclar con la migración visual; extraer tipos por dominio en tarea propia |
| `prisma/schema.prisma`                                    |   1091 | Excepción estructural; no dividir schema Prisma                               |

## Núcleo visual y theme

| Archivo                                         | Líneas | Hallazgo                                                   | Acción                      |
| ----------------------------------------------- | -----: | ---------------------------------------------------------- | --------------------------- |
| `src/app/globals.css`                           |    402 | Tokens, themes, keyframes, storefront y reportes mezclados | Dividir antes de editar     |
| `src/lib/theme/color-tokens.ts`                 |    199 | Segunda fuente de 91 colores duplicados                    | Reemplazar y retirar        |
| `tailwind.config.ts`                            |     90 | Config v3 y `hsl(var())` incompatible con tokens actuales  | Simplificar o eliminar      |
| `src/components/theme/theme-provider.tsx`       |    166 | Theme activo con riesgo de flash inicial                   | Editar en lugar             |
| `src/components/ui/animated-theme-toggler.tsx`  |     84 | Mutación paralela de `.dark`                               | Eliminar o usar provider    |
| `src/app/(system-guard)/(protected)/layout.tsx` |     81 | Gradiente con colores literales                            | Editar en lugar             |
| `src/theme/know-design-system.ts`               |  Nuevo | Fuente canónica única                                      | Crear con máximo 300 líneas |
| `scripts/check-visual-tokens.mjs`               |  Nuevo | Scanner de colores, fuentes y tamaño                       | Crear con máximo 300 líneas |

Descomposición prevista de CSS:

- `globals.css`: aliases Tailwind y base, objetivo menor a 150 líneas.
- `motion.css`: keyframes y transiciones, objetivo menor a 150 líneas.
- `storefront-theme.css`: estructura del storefront, objetivo menor a 180 líneas.
- Los valores light/dark se generan desde `know-design-system.ts`.

## Tipografía

| Archivo                                  | Hallazgo                                           | Acción                                   |
| ---------------------------------------- | -------------------------------------------------- | ---------------------------------------- |
| `src/app/layout.tsx`                     | Carga Geist y metadata antigua                     | Migrar a Satoshi local                   |
| `app/lista/render-catalog-page.tsx`      | Carga Inter desde Google                           | Retirar Inter                            |
| `src/lib/reports/tailwind-inline.ts`     | Embebe Poppins y colores                           | Reemplazar por helper Satoshi/tokenizado |
| `public/font/style.css`                  | Pesos y cursivas declarados incorrectamente        | Eliminar                                 |
| `public/font/example.html`               | Demo del paquete                                   | Eliminar                                 |
| `src/components/admin/ThemeEditor.tsx`   | 392 líneas, fuentes configurables y sin consumidor | Eliminar, no refactorizar                |
| `src/store/themeStore.ts`                | Sólo sirve al editor legacy                        | Eliminar                                 |
| `src/components/theme/ThemeInjector.tsx` | Google Fonts y `:root`, sin consumidor             | Eliminar                                 |

## Marca global

| Archivo                                  | Líneas | Acción                                                                     |
| ---------------------------------------- | -----: | -------------------------------------------------------------------------- |
| `src/components/layout/brand-logo.tsx`   |     36 | Reemplazar badge POS por componente KNOWLEDGE,cloud                        |
| `src/components/layout/sidebar-dock.tsx` |    663 | Dividir navegación, eventos, notificaciones y shells antes de editar marca |
| `src/components/layout/top-bar.tsx`      |    154 | Editar sólo si incorpora marca mobile                                      |
| `app/(system-guard)/login/page.tsx`      |     34 | Reemplazar AllData e incorporar marca                                      |
| `forgot-password/page.tsx`               |    166 | Reutilizar shell de auth                                                   |
| `reset-password/page.tsx`                |    243 | Reutilizar shell de auth                                                   |
| `consignacion-loading/[id]/page.tsx`     |    138 | Reemplazar AllData POS                                                     |
| `ticket-loading/[id]/page.tsx`           |    133 | Reemplazar AllData POS                                                     |
| `public/logo.png`                        |  Asset | Eliminar tras migrar metadata                                              |
| `public/brand/logo.png`                  |  Asset | Conservar como logo azul/dark                                              |
| `public/brand/logo_negro.png`            |  Asset | Conservar como logo light/print                                            |

## Componentes compartidos

Editar en lugar:

- `components/ui/alert-dialog.tsx`
- `components/ui/dialog.tsx`
- `components/ui/sheet.tsx`
- `components/ui/bento-grid.tsx`
- `components/ui/grid-pattern.tsx`
- `components/ui/retro-grid.tsx`
- `components/ui/progressive-blur.tsx`
- `components/ui/shimmer-button.tsx`
- `components/feedback/error-dialog.tsx`
- `components/feedback/help-dialog.tsx`
- `components/feedback/success-dialog.tsx`
- `components/reports/inventory-pdf-options-dialog.tsx`
- `components/reports/report-loading-page.tsx`

Dividir antes de editar:

- `components/timezone/timezone-migration-dialog.tsx`: 404 líneas.
- `components/notifications/notifications-panel.tsx`: 429 líneas.
- `components/ui/tutorial-button.tsx`: 334 líneas.
- `src/lib/tutorial-content.ts`: 418 líneas.

Los componentes base ya semánticos, como `button`, `input`, `card`, `badge`, `select`, `table` y `tabs`, sólo se editarán si las pruebas de contraste detectan defectos.

## Dashboard y módulos protegidos

Dividir antes de editar:

| Archivo                                                | Líneas | Extracciones principales                       |
| ------------------------------------------------------ | -----: | ---------------------------------------------- |
| `dashboard/page.tsx`                                   |    787 | Date range, data, preferencias KPI y contenido |
| `dashboard/components/tendencia-section.tsx`           |    438 | Modelo, tooltip, leyenda y chart               |
| `dashboard/components/dashboard-header.tsx`            |    431 | Rango y menú de reportes                       |
| `caja/historial/page.tsx`                              |    513 | Controller, filtros, stats y lista             |
| `consignaciones/page.tsx`                              |    754 | Controller, grouping, stats, folders y rows    |
| `consignaciones/nueva/page.tsx`                        |    715 | Controller, items, resumen y completion        |
| `consignaciones/[id]/page.tsx`                         |    664 | Controller, header, KPIs y tabla               |
| `pedidos-esperados/components/crear-pedido-dialog.tsx` |    849 | Controller, picker, items e image viewer       |
| `settings/general/page.tsx`                            |    644 | Profile, timezone, migration y business        |
| `settings/security/employees/page.tsx`                 |    607 | Controller, list y editor                      |

Los archivos menores a 300 líneas se editarán en lugar y sólo por roles semánticos.

## Storefront

Bloqueadores que deben dividirse:

| Archivo                                           | Líneas | Extracciones principales                        |
| ------------------------------------------------- | -----: | ----------------------------------------------- |
| `app/lista/catalog-client.tsx`                    |   1254 | Cart, checkout, selectors, navegación y content |
| `app/lista/components/cart-drawer.tsx`            |    680 | Customer form, pricing, checkout y states       |
| `settings/tienda/page.tsx`                        |   1050 | Controller, uploads, dirty guard y workspace    |
| `settings/tienda/components/BrandingTab.tsx`      |    822 | Logo, colores y eliminación de fonts tenant     |
| `settings/tienda/components/LayoutTab.tsx`        |    796 | Controls y featured sections                    |
| `settings/tienda/components/StorePreviewArea.tsx` |    577 | Device frame y preview real                     |

Editar o reemplazar después de la división:

- `app/lista/storefront.css`
- `app/lista/render-catalog-page.tsx`
- `app/lista/components/store-theme-wrapper.tsx`
- `app/lista/lib/theme-utils.ts`
- `src/lib/storefront/store-theme-utils.ts`
- `src/lib/storefront/public-catalog.ts`
- `src/lib/validators/settings.ts`
- `app/api/public/storefront-config/route.ts`

La regla central es que el storefront debe aplicar variables a un wrapper local y nunca a `document.documentElement`.

## Reportes y emails

Dividir antes de editar:

| Archivo                               | Líneas | Extracciones principales                      |
| ------------------------------------- | -----: | --------------------------------------------- |
| `inventory-report-template.ts`        |    534 | Types, assets, model, sections y assembler    |
| `pos-report-template.ts`              |    447 | Types, fragments y assembler                  |
| `consignacion-report-template.ts`     |    323 | View model, sections y assembler              |
| `ver/pos/[period]/pdf/route.ts`       |    437 | Resolver, queries, aggregation y PDF response |
| `ver/consig/[period]/pdf/route.ts`    |    461 | Resolver, queries, aggregation y PDF response |
| `ver/dashboard/[period]/pdf/route.ts` |    346 | Resolver, loader y PDF response               |

Editar en lugar:

- `src/lib/reports/report-theme.ts`
- `src/lib/reports/tailwind-inline.ts`
- `src/lib/reports/get-branding.ts`
- `src/lib/reports/branding-html.ts`
- `src/lib/reports/qr-helper.ts`
- `venta-report-template.ts`
- `remito-template.ts`
- `gasto-report-template.ts`
- `dashboard-report-template.ts`
- `app/api/auth/forgot-password/route.ts`

Las rutas de ticket, remito y gasto deben pasar `sucursalId` explícito a `getBranding()` para evitar branding cruzado.

## Archivos grandes fuera del alcance visual

No deben refactorizarse dentro de esta iniciativa si no necesitan cambios visuales:

- `src/lib/apiService.ts`: 1380 líneas.
- `src/lib/types.ts`: 1078 líneas.
- `src/modules/invoices/config/invoice-extraction.config.ts`: 817 líneas.
- `src/lib/dashboard/kpi-logic.ts`: 728 líneas.
- Rutas API de webhooks, ventas, productos y liquidaciones.

Se registran como deuda técnica separada. Mezclarlos con la identidad visual rompería la regla de una sola responsabilidad por sesión.

## Orden obligatorio

1. Instalar política de tamaño y baseline.
2. Dividir el archivo grande que corresponda a la fase siguiente.
3. Verificar que la extracción no alteró comportamiento.
4. Aplicar tokens, marca o tipografía.
5. Ejecutar screenshots light/dark y pruebas de regresión.
6. Eliminar la excepción de tamaño del archivo corregido.

## Conclusión

La identidad visual no debe implementarse como un reemplazo masivo de clases. Primero deben corregirse los límites estructurales de cada superficie relevante. El plan de implementación queda condicionado por esta auditoría y por el máximo estricto de 300 líneas por archivo manual.
