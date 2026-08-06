# Propuesta: Columnas fijas por rubro en el catálogo de productos

## Intención

Hoy, cuando el usuario elige un rubro en `/settings/general` (`Configuracion.rubroNegocio`), ese valor **no genera ningún campo ni columna en `/productos`**. Todo lo relacionado a atributos de producto (talle, color, vencimiento, ML, etc.) pasa por un único mecanismo genérico y manual:

- `Producto.atributosExtra` (`Json?`) — bucket libre de pares clave/valor, sin estructura ni tipos.
- `AtributosExtraEditor` — el usuario tipea la clave y el valor a mano, en una sección colapsada por default dentro del wizard de producto.
- `columnas-producto-picker.tsx` — el usuario tiene que abrir un popover y tildar manualmente qué claves quiere ver como columna en la tabla.
- `RUBROS_NEGOCIO[].atributosTipicos` (`src/modules/invoices/config/rubros.ts`) — el rubro solo aporta un string de palabras clave sueltas, usado como _sugerencia_ de autocompletado y como hint para el prompt de OCR de facturas. No valida nada, no genera nada automáticamente.

Esto fue una decisión deliberada del cambio `rubro-contexto-ocr` (ver su `design.md`, Decisión 7: _"selector manual, nunca detección automática ni columnas fijas por rubro"_), pensada para el contexto de **extracción OCR de facturas**, donde la ambigüedad y la mezcla de rubros de un negocio real hacían riesgoso un schema rígido por rubro.

Para la **carga manual de productos en el catálogo**, ese mismo diseño genera fricción real: el usuario elige "Zapatería" en Ajustes y espera que `/productos` le muestre campos como "Talle", "Color", "Número" listos para completar — no una sección colapsada de pares libres que tiene que descubrir, tipear a mano y después activar como columna en un popover aparte. Si no hace los tres pasos, el dato queda guardado pero invisible, lo cual se percibe como "no se guarda".

Esta propuesta agrega una capa de **atributos fijos y tipados por rubro**, sin tocar el pipeline de OCR de facturas ni la flexibilidad de `atributosExtra` como storage. Rubro sigue siendo un string libre + slug fijo opcional (sin cambios ahí); lo que cambia es que, cuando el rubro es uno de los slugs conocidos, `/productos` deriva de él un formulario estructurado y columnas por defecto.

## Alcance

### Dentro del alcance

1. **Catálogo de atributos fijos por rubro** — nuevo archivo `src/modules/invoices/config/rubro-atributos.ts` (o extensión de `rubros.ts`) con un `Record<string, AtributoFijoDef[]>` por slug de rubro. Cada definición: `{ clave, label, tipo: "texto" | "numero" | "seleccion" | "fecha", opciones?: string[], requerido?: boolean }`. Cobertura inicial: los ~50 rubros ya listados en `RUBROS_NEGOCIO`, con 3 a 6 atributos fijos cada uno (derivados de los `atributosTipicos` ya curados, no inventados de cero).
2. **Formulario estructurado en el wizard de producto** (`producto-wizard-dialog.tsx`) — cuando el rubro activo de la sucursal tiene atributos fijos definidos, se renderiza un input tipado por cada uno (texto/número/select/fecha), visible por default (no colapsado). Los valores se siguen guardando en `Producto.atributosExtra`, bajo la misma clave definida en el catálogo — **sin migración de schema**.
3. **Sección "otros atributos" separada** — el `AtributosExtraEditor` libre existente se mantiene, pero acotado a claves que _no_ están en el catálogo fijo del rubro activo (o a rubros sin catálogo definido / "Otro"). Evita duplicar el mismo dato en dos lugares y preserva la flexibilidad para casos no contemplados.
4. **Validación server-side tipada** — `createProductoBaseSchema`/`updateProductoSchema` (`src/lib/validators/producto.ts`) ganan una validación adicional (vía `.superRefine` o capa previa en la API route) que, dado el `rubroNegocio` de la sucursal, chequea tipo y presencia de los atributos fijos marcados `requerido`. Sigue guardando todo como `Record<string,string>` en Json — la validación es de forma en la request, no un cambio de tipo de columna en Postgres.
5. **Columnas por defecto en la tabla** — al cargar `/productos`, si `Configuracion.columnasAtributosProducto` está vacío y el rubro activo tiene atributos fijos definidos, se seedean automáticamente esas claves como columnas visibles (un solo `PUT` a `/api/settings/general`, mismo mecanismo que ya existe). El picker manual sigue disponible para agregar/quitar columnas por encima de ese default.
6. **Reclasificación de rubro después del alta inicial** — si el usuario cambia el rubro en Ajustes después de tener productos cargados, no se migran datos retroactivamente ni se borra nada; el nuevo catálogo de campos fijos aplica solo hacia adelante (alta/edición futura) y el picker de columnas no se re-seedea automáticamente una segunda vez (evita pisar una personalización manual ya hecha).

### Fuera del alcance

- Cambios al pipeline de OCR de facturas, `invoice-extraction.config.ts` o `atributosTipicos` (siguen siendo el hint de texto libre que ya son, usados solo por la IA).
- Cambiar `Producto.atributosExtra` de `Json` a columnas reales o a una tabla EAV. Sigue siendo JSON; lo nuevo es la capa de definición/validación por encima.
- Taxonomía de rubros editable por el usuario (sigue siendo la lista fija en código).
- Sistema de variantes de producto (talle/color como SKUs hijos). Cada atributo fijo sigue siendo un campo más del mismo `Producto` (1 fila = 1 SKU), no dispara la creación de variantes.
- Migración/backfill de productos ya cargados para completar los nuevos atributos fijos (quedan con lo que tengan; se completan en la próxima edición manual).
- Atributos fijos por rubro en el reporte PDF de inventario (mismo fuera-de-alcance que dejó `rubro-contexto-ocr`).

## Enfoque

### Decisión 1: reemplaza la Decisión 7 de `rubro-contexto-ocr`, pero solo para carga manual

La Decisión 7 original ("nunca columnas fijas por rubro") seguía siendo correcta para el contexto de OCR (un negocio real mezcla rubros, la IA no debe asumir un schema rígido). Para la carga manual en `/productos`, el usuario elige explícitamente su rubro sabiendo que es una simplificación — y pagar el costo de tipear todo a mano sin ayuda es peor que el costo de un catálogo fijo que se puede ignorar (queda la sección "otros atributos" para lo que no encaje). No se toca el código de OCR.

### Decisión 2: sin migración de Prisma

`atributosExtra` ya es `Json?` y ya acepta cualquier clave. El catálogo fijo por rubro vive en código (TS), igual que `RUBROS_NEGOCIO` hoy — agregar o ajustar atributos de un rubro es editar un archivo, no correr una migración.

### Decisión 3: validación de tipo, no de columna

`z.record(z.string(), z.string())` se mantiene como tipo de storage (todo se guarda como string, incluso números/fechas — igual que hoy). La validación de "tipo" (`numero`, `fecha`, `seleccion`) ocurre en la capa de refinamiento antes de persistir: por ejemplo, si `tipo: "numero"`, se valida que el string sea parseable como número; si `tipo: "seleccion"`, que el valor esté en `opciones`. Esto evita tocar el schema de Prisma o los 3 puntos de escritura existentes.

### Decisión 4: requerido es advertencia bloqueante solo en alta manual, no retroactiva

Los campos `requerido: true` bloquean el submit del wizard (create/edit) cuando falta ese atributo, pero **no** se valida retroactivamente sobre productos ya existentes — evita romper el catálogo de alguien que cambia de rubro después de tener 500 productos cargados.

## Riesgo principal a validar antes de implementar

Definir los atributos fijos de ~50 rubros es trabajo de contenido, no solo de código, y es fácil equivocarse en qué campos son realmente "fijos" vs. "típicos pero opcionales" para cada vertical. Se recomienda arrancar con un subconjunto acotado (los rubros mencionados por el usuario o los 5-8 más comunes en la base de clientes real) y expandir el resto en una fase posterior, en vez de completar los 50 de una sola vez sin validación de un dueño de producto o de usuarios reales de cada rubro.
