# Diseño: Catálogo de Productos (002-product-catalog)

## Enfoque Técnico

El enfoque se basa en construir una experiencia de solo lectura (catálogo público) aprovechando la base de datos existente. Crearemos una nueva ruta de frontend en `/tienda` y una API de solo lectura en `/api/catalog`.
El frontend utilizará React Server Components donde sea posible, interactuando con los endpoints de API que consultan el modelo `Producto` filtrando por `activo: true`. Los estilos se heredarán del motor de estilos dinámicos existente (`ThemeContext`).

## Decisiones de Arquitectura

### Decisión: Enfoque de la API de Catálogo

**Elección**: Crear un endpoint unificado `GET /api/catalog` que acepte parámetros de consulta (`page`, `limit`, `categoryId`, `minPrice`, `maxPrice`) y devuelva productos paginados, así como endpoints separados si es necesario para los filtros o devolver metadatos.
**Alternativas consideradas**: Reutilizar el endpoint `/api/productos` existente.
**Justificación**: El endpoint `/api/productos` puede estar acoplado a la lógica de backoffice (requiriendo autenticación, devolviendo precios de costo, etc.). Crear un `/api/catalog` específico para el escaparate público garantiza que no se filtren datos sensibles y no requiere autenticación.

### Decisión: Componentes UI y Estilización

**Elección**: Crear una estructura jerárquica de componentes de presentación (`ProductGrid`, `ProductCard`, `CategoryFilter`) que consuman `ThemeContext` y variables CSS genéricas de la Fase 1.
**Alternativas consideradas**: Usar clases utilitarias estáticas de Tailwind ignorando el ThemeContext.
**Justificación**: Consumir las variables CSS del motor de estilos garantiza que la tienda respete la identidad visual de cada sucursal configurada dinámicamente sin hardcodear colores o tipografías.

### Decisión: Renderizado de la página de Tienda

**Elección**: Implementar `src/app/tienda/page.tsx` como un Client Component o con un contenedor Server Component que pase datos iniciales al cliente. Dado que usa filtros y estado de paginación dinámicos, el cliente manejará el estado.
**Alternativas consideradas**: Generación Estática (SSG).
**Justificación**: El inventario puede cambiar con frecuencia. Una aproximación del lado del cliente o SSR con caché de corta duración es preferible para un catálogo dinámico y filtros interactivos.

## Flujo de Datos

    Usuario (Navegador)
         │
         ├─→ GET /tienda (Carga la UI inicial y ThemeContext)
         │
         ├─→ Filtros interactuados (estado local en React)
         │
         └─→ GET /api/catalog?page=1&categoryId=2&minPrice=100
                   │
                   ├─→ Prisma (`Producto.findMany({ where: { activo: true, ... }})`)
                   │
                   └─→ Respuesta JSON: `{ data: [...], meta: { total, pages } }`

    ProductGrid ──(mapea)──→ ProductCard (renderiza imagenUrl, nombre, precioVenta con variables CSS)

## Cambios en Archivos

| Archivo                                        | Acción | Descripción                                                                     |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `src/app/api/catalog/route.ts`                 | Crear  | Endpoint GET para listar productos filtrados y paginados (solo `activo: true`). |
| `src/app/api/catalog/categories/route.ts`      | Crear  | Endpoint GET para listar categorías y subcategorías públicas.                   |
| `src/app/tienda/page.tsx`                      | Crear  | Ruta de la página de catálogo (Shop/Tienda).                                    |
| `src/components/storefront/ProductGrid.tsx`    | Crear  | Componente de grilla para mostrar productos.                                    |
| `src/components/storefront/ProductCard.tsx`    | Crear  | Tarjeta de presentación de un producto usando variables CSS.                    |
| `src/components/storefront/CategoryFilter.tsx` | Crear  | Componente de interfaz para seleccionar filtros por categoría.                  |

## Interfaces / Contratos

```typescript
// GET /api/catalog?page=1&limit=20&categoryId=1
interface CatalogResponse {
  data: Array<{
    id: number;
    nombre: string;
    precioVenta: number;
    imagenUrl: string | null;
    categoriaId: number | null;
    subcategoriaId: number | null;
    descuentoActivo: boolean;
    descuentoPorcentaje: number | null;
  }>;
  meta: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
  };
}

// GET /api/catalog/categories
interface CategoriesResponse {
  data: Array<{
    id: number;
    nombre: string;
    subcategorias: Array<{
      id: number;
      nombre: string;
    }>;
  }>;
}
```

## Estrategia de Pruebas

| Capa              | Qué Probar         | Enfoque                                                                                                       |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------------------------- |
| Integración (API) | `GET /api/catalog` | Validar que devuelva status 200, respete la paginación y nunca devuelva `precioCosto` ni productos inactivos. |
| Unitaria (UI)     | `ProductCard`      | Renderiza correctamente nombre y precioVenta; aplica formato de moneda.                                       |

## Migración / Despliegue

No requiere migración de base de datos. Se despliegan nuevos endpoints y componentes frontend.

## Preguntas Abiertas

- [ ] ¿Cómo manejamos el caso donde un producto activo tiene 0 stockDisponibleUnits? ¿Se muestra como agotado o se oculta de la API? (Por defecto, se asume que se muestra como "Agotado").
