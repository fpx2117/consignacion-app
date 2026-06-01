# Tareas: Catálogo de Productos (002-product-catalog)

## Fase 1: API de Catálogo

- [x] 1.1 Crear `src/app/api/catalog/categories/route.ts` con endpoint `GET` que devuelva `Categoria` y sus `Subcategoria` asociadas filtrando aquellas que tengan productos activos.
- [x] 1.2 Crear `src/app/api/catalog/route.ts` con endpoint `GET` que liste registros del modelo `Producto`.
- [x] 1.3 Implementar paginación (`page`, `limit`) y filtrado (`categoryId`, `minPrice`, `maxPrice`, `activo: true`) en el endpoint de productos usando Prisma.
- [x] 1.4 Asegurar que el endpoint `/api/catalog` no exponga campos sensibles como `precioCosto` u ocultos, mapeando solo los campos requeridos en el contrato de API.

## Fase 2: Componentes UI

- [x] 2.1 Crear `src/components/storefront/ProductCard.tsx` que reciba las propiedades públicas de un producto y renderice la información utilizando los estilos del ThemeContext.
- [x] 2.2 Crear `src/components/storefront/ProductGrid.tsx` para recibir una lista de productos y mapear los elementos en el componente `ProductCard`.
- [x] 2.3 Crear `src/components/storefront/CategoryFilter.tsx` para permitir al usuario seleccionar categorías y subcategorías para el filtrado.

## Fase 3: Integración y Filtros

- [x] 3.1 Crear el archivo de página `src/app/tienda/page.tsx`.
- [x] 3.2 Implementar el estado en `src/app/tienda/page.tsx` para manejar los parámetros de filtro (categoría seleccionada, paginación, rango de precios).
- [x] 3.3 Conectar la página de Tienda con los endpoints `/api/catalog` y `/api/catalog/categories` mediante llamadas asíncronas (`fetch` o SWR/React Query).
- [x] 3.4 Probar la experiencia del catálogo asegurando que los componentes consumen el ThemeContext creado en la Fase 1.
