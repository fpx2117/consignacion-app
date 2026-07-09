# Propuesta: API Central de Catálogo Global por Rubro para Normalización OCR de Productos

## Intención

El pipeline de OCR + IA de facturas de proveedor (`extraerTextoFactura` → `procesarFacturaConIA` → `matchearItem`) hoy normaliza cada línea de producto con dos fuentes únicamente: lo que el modelo de IA infiere del texto OCR crudo, y el catálogo propio del negocio (`Producto`, `ProductoProveedorAlias`). Cuando el texto OCR viene mal escrito o mal detectado —

- `COCA-COLA 8x2,25`
- `LATA IMPERIAL *IPA* 24X473`
- `armaf odyssey go manco edp io0nl`
- `lattafa badee al qud honor and glory white edp 100ml`

— el modelo no tiene ninguna referencia externa de qué productos reales existen. `rubro-contexto-ocr` ya le da contexto de rubro al modelo (`Configuracion.rubroNegocio`, `atributosExtra` por rubro), y `mejora-precision-lineas-factura-ocr` ya valida aritméticamente lo que el modelo devuelve — pero ninguno de los dos cambios le da al modelo una lista de productos reales contra la cual comparar el texto OCR. Sin esa referencia, el modelo puede inventar nombres, corregir de más, perder variantes, confundir presentaciones o mezclar productos parecidos.

Cargar un catálogo completo de todos los rubros posibles dentro de cada base de datos de cliente (single-tenant, un deploy por negocio) no es viable: cada negocio tiene un rubro distinto (kiosco, perfumería, almacén, limpieza, ferretería), y un catálogo global de todos los rubros sería peso, ruido y mantenimiento innecesario en instancias que no lo necesitan.

Esta propuesta agrega una **API central de catálogo global**, externa a cada instancia del SaaS, que sirve productos normalizados filtrados por rubro como candidatos de referencia para el paso de normalización OCR. No reemplaza el catálogo privado del cliente (`Producto`) ni el alias por proveedor (`ProductoProveedorAlias`) — es una tercera fuente, consultada solo cuando las dos primeras no alcanzan.

## Alcance

### Dentro del Alcance

1. **Nuevo servicio HTTP independiente** (`catalogo-global-api`, repositorio/código separado de `consignacion-app`, con base de datos Postgres y deploy propios — no vive en `src/` ni comparte base con ninguna instancia de cliente) que expone un catálogo de productos normalizados, filtrable por rubro, marca, categoría, código de barras y texto libre. Detalle de stack, modelo de datos y endpoints en `design.md`.
2. **Endpoint principal `POST /catalogo/ocr-candidatos`**: recibe rubro + descripción OCR cruda (+ hint de categoría opcional), devuelve una lista de candidatos ordenados por score, sin datos del cliente.
3. **Cliente HTTP en el SaaS** (`src/lib/ai/catalogo-global-client.ts`, nuevo): wrapper con timeout corto, sin reintentos automáticos, que llama al endpoint anterior y nunca lanza — ante cualquier falla (timeout, 5xx, red caída) devuelve lista vacía y logea un warning, siguiendo el mismo criterio de "no bloquear el pipeline" ya usado en `rubro-contexto-ocr`.
4. **Integración en `procesarFacturaConIA()`**: los candidatos globales se agregan al prompt como tercera fuente (después de catálogo local y alias de proveedor), en la sección ya existente de contexto — el modelo los usa para elegir/normalizar, nunca para inventar si no hay ninguno.
5. **Uso de `Configuracion.rubroNegocio` existente** (agregado en `rubro-contexto-ocr`) como filtro de rubro en cada consulta a la API central — no se agrega un campo nuevo de rubro, se reusa el que ya existe.
6. **Persistencia local de confirmaciones**: cuando el usuario confirma un item en `factura-proveedor-dialog.tsx` que vino de un candidato global, se guarda la vinculación en `ProductoProveedorAlias` (campo nuevo `productoGlobalId String?`, ver `design.md`) — así la próxima vez que aparezca el mismo texto de proveedor, se resuelve localmente sin volver a consultar la API central ni a la IA.
7. **Autenticación entre servicios**: API key fija por instancia (`CATALOGO_API_KEY` en variables de entorno), enviada como `Authorization: Bearer` — sin OAuth ni rotación automática en esta primera iteración.
8. **Fuente de datos inicial: sync desde la API pública (no oficial) de Precios Claros**, no CSV manual. Se eligen unas pocas sucursales representativas de cadenas grandes (Coto, Carrefour, Día, Jumbo, etc. — los productos de marca nacional como Coca-Cola/Imperial tienen el mismo código de barras en cualquier sucursal), se unifica su catálogo de productos deduplicando por código de barras, y se clasifica por rubro/categoría con una heurística propia (la API no expone categoría por producto, ver `design.md`, Decisión 6). El CSV manual queda solo como mecanismo de override puntual (`POST /admin/import/csv`, ya definido), no como fuente principal.

### Fuera del Alcance

- **Sincronización con Open Food Facts u otras fuentes externas además de Precios Claros.** Precios Claros ya cubre el rubro piloto (kiosco/almacén); sumar una segunda fuente queda para cuando se expanda a otro rubro que Precios Claros no cubra bien (perfumería, ferretería).
- **Categorización automática confiable por categoría/subcategoría fina.** La API de Precios Claros no expone categoría por producto (ver `design.md`, Decisión 6) — la clasificación en esta iteración es una heurística por palabras clave del nombre, aceptablemente imprecisa a nivel subcategoría (puede confundir "Gaseosas" con "Aguas saborizadas"), pero suficiente para el filtro grueso por rubro que necesita el matching.
- **Búsqueda fuzzy avanzada (Meilisearch/Typesense/Elasticsearch).** La primera versión usa `ILIKE`/trigram de PostgreSQL. Migrar a un motor de búsqueda dedicado es una mejora de una iteración posterior, condicionada a medir primero si la calidad de matching con texto normalizado + trigram alcanza.
- **Multi-tenant real en la API central** (que un cliente pueda escribir/curar su propio catálogo global). La API central es de solo lectura para las instancias del SaaS en esta iteración; la escritura es interna (import CSV, admin).
- **Enviar correcciones/confirmaciones del cliente de vuelta a la API central** para mejorar el catálogo global entre negocios. Fuera de alcance por privacidad — cada instancia sigue siendo single-tenant y no comparte datos de vuelta en esta iteración (ver sección "Seguridad y privacidad" en `design.md`).
- **Reintento automático o segunda pasada de IA cuando la API central no devuelve candidatos.** Mismo criterio ya aplicado en `rubro-contexto-ocr` y `mejora-precision-lineas-factura-ocr`: si no hay candidatos, el item queda para revisión manual, no se encadenan más llamados.
- **Panel de administración del catálogo global** (alta/edición manual de productos vía UI). La carga inicial es por script/CSV; un panel admin queda para una iteración posterior si el volumen de curación lo justifica.
- **Migrar el rubro de "hint contextual" a "schema distinto".** Se mantiene el principio ya establecido en `rubro-contexto-ocr`: un único prompt/schema, el rubro solo filtra candidatos y da contexto, no bifurca lógica.

### Módulos/paquetes afectados

- **Servicio externo complementario**: `catalogo-global-api` (código separado de `consignacion-app`, base de datos y deploy propios).
- **Este repo (SaaS cliente)**:
  - `src/lib/ai/catalogo-global-client.ts` (nuevo)
  - `src/lib/ai/invoice-ai-parser.ts` (integra candidatos globales en `procesarFacturaConIA()`)
  - `src/modules/invoices/config/invoice-extraction.config.ts` (agrega sección de candidatos globales al prompt)
  - `src/app/api/facturas-proveedor/[id]/process/route.ts` (pasa `rubroNegocio` de `Configuracion` al parser, persiste vinculación al confirmar)
  - `prisma/schema.prisma` — `ProductoProveedorAlias.productoGlobalId String?` (columna aditiva, nullable, sin migración de datos existentes)
  - `.env` / variables de entorno: `CATALOGO_API_URL`, `CATALOGO_API_KEY`, `CATALOGO_API_TIMEOUT_MS`
  - Sin cambios de UI obligatorios: el candidato global se ve igual que cualquier otro candidato de matching en `factura-proveedor-dialog.tsx` (mismo componente, fuente adicional).

## Plan de reversión (rollback)

Este cambio es aditivo y aislado por diseño — ninguna ruta existente deja de funcionar si se revierte:

1. **Si la API central falla o se decide no usarla más**: el cliente HTTP (`catalogo-global-client.ts`) ya está diseñado para degradar a lista vacía ante cualquier error (punto 3 del alcance) — no hace falta revertir código para "apagar" la dependencia, alcanza con no configurar `CATALOGO_API_URL` (feature-off por ausencia de config, sin flag booleano nuevo que mantener).
2. **Si hay que revertir la integración completa en este repo**: revertir el commit/PR que toca `invoice-ai-parser.ts` + `invoice-extraction.config.ts` + `process/route.ts` es seguro — el pipeline vuelve exactamente al comportamiento actual (catálogo local + alias de proveedor, sin tercera fuente).
3. **Columna `ProductoProveedorAlias.productoGlobalId`**: nullable y sin `NOT NULL`/default obligatorio — no requiere backfill ni rollback de datos si se decide no usarla más; simplemente queda sin popular.
4. **La API central en sí (servicio externo)**: al ser un deploy independiente, apagarlo no rompe el build ni el deploy de este SaaS — el fallback del punto 1 ya cubre ese caso en producción.
5. **Sin downtime esperado**: el rollout es progresivo — se puede activar `CATALOGO_API_URL` en una sola instancia de prueba antes de habilitarlo en el resto, sin coordinar un cambio simultáneo en todos los clientes (cada deploy es independiente, propiedad ya inherente al modelo single-tenant del proyecto).
