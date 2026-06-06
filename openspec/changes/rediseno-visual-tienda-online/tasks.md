# Tareas: Rediseño Visual de Tienda Online Configurable

## Fase 1: Infraestructura de Configuración

- [ ] 1.1 Crear tipo `OnlineStoreSettings` completo en `src/lib/types.ts` con todos los subtipos
- [ ] 1.2 Crear defaults `defaultOnlineStoreSettings` en `src/lib/types.ts`
- [ ] 1.3 Extender modelo Prisma `StoreSettings` con campo `onlineStoreConfig Json?` en `prisma/schema.prisma`
- [ ] 1.4 Crear validador Zod `onlineStoreSettingsSchema` en `src/lib/validators/settings.ts`
- [ ] 1.5 Extender `GET /api/settings` para devolver `onlineStoreConfig`
- [ ] 1.6 Extender `PATCH /api/settings` para aceptar y guardar `onlineStoreConfig`
- [ ] 1.7 Extender `GET /api/public/storefront-config` para incluir `onlineStoreConfig`
- [ ] 1.8 Crear hook `useOnlineStoreSettings` en `src/hooks/useOnlineStoreSettings.ts`

## Fase 2: Helpers Visuales y CSS Variables

- [ ] 2.1 Crear `src/lib/store-theme-utils.ts` con helpers: `getRadiusClass`, `getShadowClass`, `getCardStyleClass`, `getButtonStyleClass`, `getProductLayoutClass`, `getDesktopLayoutClass`
- [ ] 2.2 Extender `src/app/lista/storefront.css` con variables `--store-*` (primary, secondary, background, surface, text, muted, whatsapp)
- [ ] 2.3 Extender `src/app/lista/page.tsx` para inyectar nuevas CSS variables (`--store-primary`, `--store-background`, etc.) desde settings
- [ ] 2.4 Crear `src/app/lista/components/store-theme-wrapper.tsx` — wrapper client que aplica CSS vars como `style` prop

## Fase 3: Componentes Nuevos

- [ ] 3.1 Crear `src/app/lista/components/search-bar.tsx` — buscador independiente extraído de StoreFilters
- [ ] 3.2 Crear `src/app/lista/components/category-tabs.tsx` — tabs horizontales con scroll, indicador activo
- [ ] 3.3 Crear `src/app/lista/components/promo-carousel.tsx` — cards de promociones desplazables
- [ ] 3.4 Crear `src/app/lista/components/product-section.tsx` — sección por categoría con "Ver todo"
- [ ] 3.5 Crear `src/app/lista/components/whatsapp-preview.tsx` — preview visual del mensaje en carrito
- [ ] 3.6 Crear `src/app/lista/components/order-item.tsx` — item individual en carrito con selector de cantidad pill
- [ ] 3.7 Crear `src/app/lista/components/order-summary.tsx` — resumen de subtotal/total

## Fase 4: Rediseño de Componentes Existentes

- [ ] 4.1 Rediseñar `product-card.tsx` — cards limpias, imagen/configurable, add button configurable, usar settings
- [ ] 4.2 Rediseñar `cart-drawer.tsx` → soportar bottom sheet real en mobile (slide-up con overlay, bordes superiores redondeados, barra indicadora)
- [ ] 4.3 Rediseñar `cart-drawer.tsx` → soportar modal/drawer lateral en desktop según `cart.displayMode`
- [ ] 4.4 Rediseñar `store-header.tsx` — banner overlay + logo + info comercio + badge verificación + botón carrito
- [ ] 4.5 Rediseñar `store-banner.tsx` — overlay suave con blur, mejor integración con header
- [ ] 4.6 Adaptar `store-filters.tsx` para que use el nuevo `SearchBar` y `CategoryTabs`

## Fase 5: Hooks y Extracción de Lógica

- [ ] 5.1 Crear hook `useCart` en `src/hooks/useCart.ts` — extraer lógica de carrito de `catalog-client.tsx` (estado, localStorage sync, addToCart, removeFromCart, updateQuantity, clearCart, subtotal, total)
- [ ] 5.2 Integrar `useOnlineStoreSettings` y `useCart` en `catalog-client.tsx`
- [ ] 5.3 Refactorizar `catalog-client.tsx` para delegar en hooks y componentes nuevos

## Fase 6: Panel Admin — Configuración Visual

- [ ] 6.1 Agregar pestaña "Online Store" en `settings/tienda/page.tsx`
- [ ] 6.2 Crear `StoreIdentitySettings` — formulario para identidad visual (nombre, logo, banner, descripción, horarios, dirección)
- [ ] 6.3 Crear `StoreAppearanceSettings` — formulario para colores, modo, bordes, sombras, estilos
- [ ] 6.4 Crear `StoreCatalogSettings` — formulario para catálogo (mostrar/ocultar, layout, máximos)
- [ ] 6.5 Crear `StorePromotionSettings` — CRUD de promociones visuales
- [ ] 6.6 Crear `StoreCartSettings` — formulario para carrito y WhatsApp
- [ ] 6.7 Crear `StoreResponsiveSettings` — selector de layout desktop
- [ ] 6.8 Integrar guardado vía `apiService` existente (`actualizarStoreSettings` o PATCH `/api/settings`)

## Fase 7: Integración Final y Verificación

- [ ] 7.1 Ensamblar todos los componentes en `catalog-client.tsx` con el nuevo layout
- [ ] 7.2 Ejecutar build (`npm run build`) y verificar que no haya errores de TypeScript ni Tailwind
- [ ] 7.3 Verificar que los 8 temas existentes (modern, nature, etc.) siguen funcionando
- [ ] 7.4 Verificar que el carrito, búsqueda, categorías y WhatsApp funcionan idéntico a antes
- [ ] 7.5 Verificar responsive: mobile (bottom sheet, tabs, cards 2 cols) y desktop (3 layouts)
