# Propuesta: Rediseño Visual de Tienda Online Configurable

## Intención

Transformar la capa visual del storefront público (`/lista`) en una interfaz moderna, mobile-first, estilo app de pedidos por WhatsApp, **100% configurable desde el panel admin** sin necesidad de tocar código. El sistema debe ser genérico: adaptable a cualquier rubro comercial (no atado a kioscos, bebidas, ni ningún nicho específico).

**Problema**: El storefront actual tiene una estética funcional pero no alcanza el nivel visual de una app de delivery/catálogo moderna. Los elementos visuales (colores, layouts, textos) están parcialmente configurables pero dispersos entre `Branding`, `Configuracion` y `StoreSettings`. Faltan componentes clave (tabs de categorías, promos visuales, preview WhatsApp, bottom sheet real).

**Motivación del usuario**: "Necesito rediseñar visualmente el frontend de mi tienda online / catálogo de ventas."

## Alcance

### Dentro del Alcance

1. **Unificar configuración visual** en un tipo `OnlineStoreSettings` extendiendo los modelos existentes (`StoreSettings` o `Branding`)
2. **Crear/adaptar componentes visuales** faltantes:
   - `CategoryTabs` — tabs horizontales con scroll para categorías
   - `PromoCarousel` — cards de promociones visuales configurables
   - `WhatsAppPreview` — preview visual del mensaje dentro del carrito
   - `SearchBar` — buscador independiente (extraído de StoreFilters)
   - `ProductSection` — sección de productos por categoría con "Ver todo"
3. **Rediseñar componentes existentes** a la nueva estética:
   - `ProductCard` — cards limpias, add button configurable, imágenes opcionales
   - `CartDrawer` — adaptar a bottom sheet real en mobile (y modal/drawer en desktop)
   - `StoreHeader` — banner + logo + info comercio + badge verificación
   - `StoreBanner` — overlay suave, blur, integración con header
4. **Crear hooks** para desacoplar lógica de presentación:
   - `useOnlineStoreSettings()` — obtener config + defaults seguros
   - `useCart()` — extraer lógica del carrito de `catalog-client.tsx`
5. **Crear helpers visuales**:
   - `getRadiusClass()`, `getShadowClass()`, `getCardStyleClass()`, `getButtonStyleClass()`, `getProductLayoutClass()`
6. **CSS Variables** para colores dinámicos (sin clases Tailwind arbitrarias)
7. **Extender panel admin** (`settings/tienda`) con sección unificada "Configuración de tienda online"
8. **Valores por defecto** seguros: azul `#007AFF` principal, verde `#25D366` WhatsApp, fondo `#F5F6F8`
9. **Responsive**: mobile-first (app nativa), desktop configurable (mobile-centered / wide-ecommerce / with-cart-sidebar)

### Fuera del Alcance

- **NO** modificar lógica de carrito, cantidades, precios ni envío por WhatsApp
- **NO** modificar endpoints existentes (solo extender si es necesario para nuevos campos de settings)
- **NO** cambiar nombres de funciones existentes ni estructura de datos
- **NO** crear nueva arquitectura de backend
- **NO** eliminar código funcional existente
- **NO** modificar autenticación, permisos ni seguridad
- **NO** crear lógica de descuentos reales (solo promos visuales/informativas)
- **NO** hardcodear identidad visual, textos, colores ni logos
- **NO** crear páginas nuevas (solo extender `/lista` y `settings/tienda`)

## Enfoque

**Estrategia**: Capa visual pura sobre infraestructura existente. Extender, no reemplazar.

1. **Fase 1 — Infraestructura de configuración**: Extender modelo `StoreSettings` con JSON `onlineStoreConfig`, crear tipo `OnlineStoreSettings` con defaults, exponerlo en API existente (`/api/settings`), crear hook `useOnlineStoreSettings`.
2. **Fase 2 — Helpers visuales + CSS**: Crear `src/lib/store-theme-utils.ts` con helpers de clases, extender `storefront.css` con variables `--store-*`, inyectar CSS vars desde `page.tsx`.
3. **Fase 3 — Componentes nuevos**: `CategoryTabs`, `PromoCarousel`, `WhatsAppPreview`, `SearchBar`, `ProductSection`.
4. **Fase 4 — Rediseño de componentes existentes**: `ProductCard`, `CartDrawer` → bottom sheet, `StoreHeader`, `StoreBanner`.
5. **Fase 5 — Hooks**: `useOnlineStoreSettings`, `useCart` (extracción de `catalog-client.tsx`).
6. **Fase 6 — Panel admin**: Nueva pestaña "Online Store" en `settings/tienda` con secciones de configuración.
7. **Fase 7 — Integración y pruebas**: Ensamblar todo en `catalog-client.tsx`, verificar que nada se rompa.

**Principio clave**: Cada componente recibe `settings: OnlineStoreSettings` como prop y usa CSS variables para colores. Nada se hardcodea.

## Áreas Afectadas

| Área                                                             | Impacto    | Descripción                                            |
| ---------------------------------------------------------------- | ---------- | ------------------------------------------------------ |
| `src/lib/types.ts`                                               | Modificado | Agregar `OnlineStoreSettings` y subtipos               |
| `prisma/schema.prisma`                                           | Modificado | Extender `StoreSettings` con campo `onlineStoreConfig` |
| `src/app/api/settings/route.ts`                                  | Modificado | Devolver/guardar `onlineStoreConfig`                   |
| `src/lib/validators/settings.ts`                                 | Modificado | Agregar schema Zod para `OnlineStoreSettings`          |
| `src/lib/store-theme-utils.ts`                                   | Nuevo      | Helpers visuales: radius, shadow, card, button, layout |
| `src/hooks/useOnlineStoreSettings.ts`                            | Nuevo      | Hook para consumir config con defaults                 |
| `src/hooks/useCart.ts`                                           | Nuevo      | Hook de carrito extraído de catalog-client             |
| `src/app/lista/page.tsx`                                         | Modificado | Inyectar nuevas CSS variables                          |
| `src/app/lista/storefront.css`                                   | Modificado | Variables `--store-*` adicionales                      |
| `src/app/lista/catalog-client.tsx`                               | Modificado | Integrar hooks, nuevos componentes                     |
| `src/app/lista/components/search-bar.tsx`                        | Nuevo      | Buscador independiente                                 |
| `src/app/lista/components/category-tabs.tsx`                     | Nuevo      | Tabs horizontales de categorías                        |
| `src/app/lista/components/promo-carousel.tsx`                    | Nuevo      | Cards de promociones visuales                          |
| `src/app/lista/components/product-section.tsx`                   | Nuevo      | Sección de productos por categoría                     |
| `src/app/lista/components/whatsapp-preview.tsx`                  | Nuevo      | Preview visual del mensaje WhatsApp                    |
| `src/app/lista/components/order-item.tsx`                        | Nuevo      | Item individual en carrito                             |
| `src/app/lista/components/order-summary.tsx`                     | Nuevo      | Resumen de totales en carrito                          |
| `src/app/lista/components/product-card.tsx`                      | Modificado | Rediseño visual con settings                           |
| `src/app/lista/components/cart-drawer.tsx`                       | Modificado | Adaptar a bottom sheet real                            |
| `src/app/lista/components/store-header.tsx`                      | Modificado | Nuevo layout con banner+logo+info                      |
| `src/app/lista/components/store-banner.tsx`                      | Modificado | Overlay suave, blur                                    |
| `src/app/(system-guard)/(protected)/settings/tienda/page.tsx`    | Modificado | Nueva pestaña "Online Store"                           |
| `src/app/(system-guard)/(protected)/settings/tienda/components/` | Modificado | Componentes de config visual                           |
| `src/app/api/public/storefront-config/route.ts`                  | Modificado | Incluir onlineStoreConfig en respuesta                 |

## Riesgos

| Riesgo                                                 | Probabilidad | Mitigación                                                                                                             |
| ------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Romper funcionalidad existente del carrito             | Media        | No tocar lógica de `catalog-cart-pricing.ts` ni `catalog-whatsapp.ts`. Solo cambiar presentación                       |
| CSS variables no se compilan en Tailwind v4            | Media        | Usar `style={{ '--var': value }}` inline + `var(--var)` en clases. Si no funciona, usar clases auxiliares con `@apply` |
| Migración Prisma falla por campo nuevo                 | Baja         | Agregar campo opcional (`Json?`) con default. Sin migración destructiva                                                |
| Regresiones visuales en temas existentes               | Media        | Preservar los 8 temas actuales. El nuevo sistema de settings es una capa adicional, no un reemplazo                    |
| Conflictos de merge con cambios previos no commiteados | Baja         | Revisar `git status` antes de empezar                                                                                  |

## Plan de Reversión (Rollback)

1. **Por componente**: cada nuevo componente se integra con un flag condicional. Si `onlineStoreConfig` no existe, se usa el layout actual (fallback 100% compatible).
2. **Por migración**: el campo `onlineStoreConfig` es `Json?` opcional. Si falla, eliminar el campo del schema y revertir migration.
3. **Git**: trabajar en branch `rediseno-visual-tienda-online`. Si algo sale mal, descartar branch. Main queda intacto.
4. **Feature flags**: usar `process.env.NEXT_PUBLIC_ENABLE_NEW_STORE_FRONTEND` como kill switch si es necesario (opcional).

## Dependencias

- Ninguna dependencia externa nueva. Todo usa packages existentes (`motion`, `lucide-react`, `zustand`, `tailwindcss`).
- Requiere que el modelo `StoreSettings` exista (ya existe en `prisma/schema.prisma` línea 630-638).

## Criterios de Éxito

- [ ] La tienda `/lista` se renderiza con la nueva estética visual sin errores
- [ ] Todos los colores, textos, layouts son configurables desde el panel admin sin tocar código
- [ ] El carrito funciona como bottom sheet en mobile (animación slide-up)
- [ ] Las categorías se muestran como tabs horizontales con scroll
- [ ] Las promociones visuales se pueden crear/editar/eliminar desde el admin
- [ ] El preview de WhatsApp se muestra dentro del carrito y es configurable
- [ ] La búsqueda, categorías, carrito, cantidades y envío por WhatsApp siguen funcionando exactamente igual
- [ ] Los temas existentes (modern, nature, ocean, etc.) siguen funcionando
- [ ] No hay regresiones visuales ni funcionales
- [ ] El panel admin tiene una sección "Online Store" con todas las opciones de configuración
