# Propuesta: Catálogo de Productos (002-product-catalog)

## Intención

Crear la interfaz de usuario pública y los endpoints de API necesarios para el catálogo de productos de la tienda E-commerce. Se reutilizarán estrictamente los modelos existentes en el esquema de la base de datos (`Producto`, `Categoria`, y `Subcategoria`), sin requerir nuevas tablas ni modificaciones en Prisma. El objetivo es permitir a los usuarios visualizar, filtrar y explorar el inventario existente, utilizando el motor de estilos ya implementado.

## Alcance

### Dentro del Alcance

- **Backend (API):** Endpoints para listar registros del modelo existente `Producto`, con soporte para paginación y filtrado (ej. por `precioVenta` y `categoriaId`/`subcategoriaId`), además de endpoints para consultar `Categoria` y `Subcategoria`.
- **Frontend (UI Pública):** Componentes `ProductGrid` y `ProductCard` que lean directamente la estructura de datos de los modelos existentes y consuman las variables CSS creadas en la Fase 1 (settings).

### Fuera del Alcance

- Modificar, crear o eliminar tablas en Prisma (se respeta el esquema actual).
- Autenticación o roles de usuario (administradores vs clientes).
- Carrito de compras, checkout y pasarelas de pago.
- Paneles de administración (Backoffice) para creación y gestión de productos.

## Enfoque

- **Persistencia:** Cero modificaciones a la base de datos. Se operará exclusivamente en modo lectura y consulta sobre los modelos `Producto`, `Categoria` y `Subcategoria` ya definidos en el sistema.
- **API:** Implementar endpoints que acepten parámetros de query (`page`, `limit`, `minPrice`, `maxPrice`, `categoryId`, `subcategoryId`) y construyan dinámicamente el objeto `where` de Prisma para el modelo `Producto`.
- **UI:** Crear componentes de presentación y listado en React (`ProductCard` y `ProductGrid`). Estos componentes mapearán las propiedades existentes (`id`, `nombre`, `precioVenta`, `imagenUrl`, etc.) y estarán estilizados íntegramente consumiendo las variables globales CSS definidas en nuestro motor de estilos.

## Áreas Afectadas

| Área                    | Impacto | Descripción                                                                                           |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| API / Rutas de Backend  | Nuevo   | Endpoints para la obtención y filtrado del catálogo leyendo `Producto`, `Categoria` y `Subcategoria`. |
| Componentes de Interfaz | Nuevo   | Creación de componentes `ProductGrid` y `ProductCard` usando variables CSS de la Fase 1.              |

## Riesgos

| Riesgo                                                                     | Probabilidad | Mitigación                                                                                                     |
| -------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------- |
| Consultas a BD lentas por uso de filtros y paginación en grandes volúmenes | Media        | Optimizar las consultas usando las relaciones e índices ya existentes en el esquema actual de Prisma.          |
| Desalineación con el motor de estilos actual                               | Baja         | Usar estrictamente las variables CSS preexistentes de la Fase 1; revisar visualmente frente a guías de estilo. |

## Plan de Reversión (Rollback)

- Deshacer la creación de los archivos correspondientes a las rutas de la API de productos.
- Eliminar la creación de los componentes de React introducidos (`ProductCard`, `ProductGrid`).

## Dependencias

- Motor de estilos CSS (implementado en Fase 1).
- Cliente de Prisma configurado e inicializado, apuntando al esquema con los modelos `Producto`, `Categoria` y `Subcategoria`.

## Criterios de Éxito

- [ ] Es posible consultar la API obteniendo registros de `Producto` filtrados por rango de precio y por ID de categoría, de manera paginada.
- [ ] La API expone correctamente los listados de `Categoria` y `Subcategoria` para alimentar los filtros del frontend.
- [ ] La interfaz expone de forma responsiva las tarjetas de producto (`ProductCard`) en una grilla (`ProductGrid`), renderizando los datos reales y utilizando los estilos definidos en las variables CSS.
