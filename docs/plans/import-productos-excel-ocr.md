# Análisis: carga masiva de productos (Excel) y OCR de facturas

> Documento de análisis técnico, **no implementación**. Objetivo: decidir cómo, al agregar
> productos, ofrecer dos vías adicionales a la carga manual actual:
>
> 1. Plantilla Excel genérica (exportar/importar) con los nombres de columnas del sistema.
> 2. OCR de facturas de proveedores para extraer productos y stock automáticamente.
>
> Restricción del negocio: **todo debe poder hacerse con herramientas gratuitas** (sin
> costo de licencia ni de API por uso, o con un free tier suficiente para el volumen actual).

## 1. Estado actual del sistema

- Modelo `Producto` en `prisma/schema.prisma:221-264` (PostgreSQL vía Prisma 7 + `pg`).
  Campos relevantes para import/export: `nombre`, `precioVenta`, `precioCosto`,
  `stockDisponibleUnits`, `stockConsignadoUnits`, `packSizeUnits`, `stockMinUnits`,
  `fechaVencimiento`, `categoriaId`/`categoria`, `subcategoriaId`/`subcategoria`,
  `codigoBarra`, `sku`, `descripcion`, `iva`, `sucursalId`, `imagenUrl`, campos de
  descuento (`descuentoPorcentaje`, `descuentoMonto`, `tipoDescuento`, `descuentoActivo`,
  `descuentoDesde/Hasta`).
- Constraints a respetar en cualquier importador: `@@unique([codigoBarra, sucursalId])`,
  `@@unique([sku, sucursalId])`.
- Alta manual hoy: `create-producto-dialog.tsx` (formulario) → `apiService` →
  `src/app/api/productos/route.ts` (POST) — valida con Zod (`src/lib/validators/producto.ts`).
- **No existe** hoy ninguna funcionalidad de import/export de archivos ni dependencias
  de manejo de CSV/XLSX (`xlsx`, `papaparse`, `multer`, etc.) ni de OCR (`tesseract`, etc.)
  en `package.json`. Se parte de cero en ambos frentes.
- Ya hay infraestructura reutilizable: subida de imágenes (`src/components/image-upload.tsx`),
  Zod para validación, react-hook-form para UI, Puppeteer (podría generar plantillas PDF
  si hiciera falta, aunque no es necesario para Excel).

## 2. Opción A — Plantilla Excel genérica (exportar/importar)

### 2.1 Objetivo

El sistema ofrece un botón "Descargar plantilla" que genera un `.xlsx` con una hoja cuyas
columnas son exactamente los campos importables de `Producto` (con nombres en español,
tipos y ejemplos). El usuario la completa (en Excel, Google Sheets o LibreOffice) y la
vuelve a subir con "Importar productos"; el sistema valida y crea/actualiza en lote.

### 2.2 Librerías gratuitas candidatas (Node/Next.js)

| Librería                               | Licencia   | Rol                                                                       | Notas                                                                                                                                                                                                                                                        |
| -------------------------------------- | ---------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`xlsx` (SheetJS Community Edition)** | Apache-2.0 | Leer y escribir `.xlsx`/`.csv`                                            | La más usada históricamente; la CE cubre lectura/escritura básica de celdas y tipos. Desde 2023 se distribuye vía tarball propio de SheetJS (no siempre la última versión está en npm registry por defecto) — hay que fijar la URL exacta en `package.json`. |
| **`exceljs`**                          | MIT        | Leer y escribir `.xlsx` con estilos, validaciones de celda, dropdowns     | Alternativa 100% npm-friendly, sin el problema de distribución de SheetJS. Permite poner **listas desplegables** en la plantilla (ej. categoría) y formato condicional, lo cual mejora mucho la UX de la plantilla.                                          |
| **`papaparse`**                        | MIT        | Parseo de CSV en cliente o servidor                                       | Útil si además se quiere soportar `.csv` puro (más liviano, sin librerías de Excel).                                                                                                                                                                         |
| **`zod`** (ya está)                    | MIT        | Validar cada fila importada contra el mismo schema que usa el alta manual | Reutilizar `src/lib/validators/producto.ts` extendiéndolo para aceptar filas planas.                                                                                                                                                                         |

**Recomendación:** `exceljs` para generar la plantilla (con dropdowns de categoría/subcategoría
reales de la base y formato de columnas) y para parsear el archivo importado. Evita la
fricción de distribución de `xlsx`/SheetJS y es totalmente gratuito (MIT, sin límites).

### 2.3 Diseño funcional propuesto

1. **Exportar plantilla** (`GET /api/productos/plantilla`):
   - Genera un `.xlsx` con:
     - Hoja "Productos": columnas = campos editables (nombre, sku, código de barra,
       precioCosto, precioVenta, stock disponible, stock mínimo, categoría, subcategoría,
       IVA, descripción, fecha de vencimiento).
     - Fila de encabezado con nombres claros + comentarios/notas por columna explicando
       formato esperado (ej. "IVA: número, ej 21").
     - Hoja auxiliar oculta o segunda hoja "Categorías" con el listado real de
       categorías/subcategorías de la sucursal, usada como _data validation_ (dropdown)
       en la columna Categoría de la hoja principal.
     - Si se quiere permitir **actualizar productos existentes**, incluir opcionalmente
       una export "con datos actuales" (mismo botón, pero prellenado) además de la
       plantilla vacía.

2. **Importar** (`POST /api/productos/importar`, `multipart/form-data`):
   - Parsear con `exceljs`.
   - Validar fila a fila con Zod (mensajes de error por fila/columna).
   - Reglas de conciliación:
     - Si `sku` o `codigoBarra` ya existe en esa `sucursalId` → actualizar (UPDATE),
       si no existe → crear (INSERT). Esto da un comportamiento tipo _upsert_.
     - Resolver `categoria`/`subcategoria` por nombre (no por ID, porque el usuario no
       conoce los IDs) — buscar o, si no existe, opción de crear automáticamente o
       marcar error, a definir con el usuario.
   - Ejecutar en una transacción por lote (Prisma `$transaction`) con límite de filas
     (ej. 500) para no bloquear la request.
   - Devolver un **reporte de importación**: filas creadas, actualizadas, con error
     (y motivo), para mostrar en la UI antes/después de confirmar.
   - Recomendado: modo "previsualizar" (dry-run) que solo valida y muestra el resumen,
     y un segundo paso "confirmar" que efectivamente escribe — evita cargas erróneas
     masivas sin posibilidad de revisión.

3. **UI**: un diálogo similar a `create-producto-dialog.tsx` pero con dos botones
   ("Descargar plantilla" / "Importar archivo") en la pantalla de listado de productos,
   con tabla de previsualización de errores (usando componentes ya existentes de
   shadcn/ui, p. ej. `Table`, `Alert`).

### 2.4 Riesgos y puntos a decidir con el usuario

- ¿Importar reemplaza stock (`stockDisponibleUnits = X`) o lo **suma** (entrada de
  mercadería)? Esto es crítico porque afecta `movimientoStocks` — probablemente conviene
  generar un `MovimientoStock` por cada fila importada en vez de pisar el campo directo,
  para mantener trazabilidad (igual que el alta manual, si aplica).
  Nota: en el análisis actual no se profundizó cómo se relaciona `movimientoStocks` con
  la creación de producto vs. ajustes de stock; conviene revisar ese flujo antes de
  implementar para no romper la trazabilidad de inventario.
- Manejo de imágenes: el Excel no puede llevar archivos de imagen fácilmente; se podría
  aceptar una columna `imagenUrl` (URL externa) o dejar la imagen fuera del flujo de
  importación masiva (se completa después manualmente).
- Multi-sucursal: si el usuario administra varias sucursales, la plantilla debe dejar
  claro para qué `sucursalId` está generando/importando, o incluir una columna Sucursal.

### 2.5 Costo

Cero. `exceljs` es MIT, corre 100% en el servidor Next.js existente, sin servicios externos.

## 3. Opción B — OCR de facturas para extraer productos y stock

### 3.1 Objetivo

El usuario sube una foto o PDF de una factura de proveedor; el sistema extrae texto,
identifica líneas de producto (nombre, cantidad, precio) y las prellena como borrador
de importación (mismo mecanismo de previsualización que la Opción A), para que el
usuario confirme antes de crear/actualizar productos y sumar stock.

### 3.2 Alternativas gratuitas de OCR

| Opción                                                                                           | Tipo                                                        | Costo                                                   | Calidad esperada                                                                                                                            | Complejidad de integración                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tesseract.js**                                                                                 | OCR de código abierto (WASM), corre en Node o en el browser | Gratis, sin límite, sin llamadas externas               | Buena en texto impreso limpio y bien escaneado; débil en facturas con tablas complejas, letra chica, o fotos con mala luz/perspectiva       | Baja-media: `npm install tesseract.js`, no requiere servicios externos, pero el post-procesamiento (pasar de "texto plano" a "filas de producto/cantidad/precio") hay que construirlo a mano (regex/heurísticas) |
| **PaddleOCR / PaddleOCR-json**                                                                   | OCR de código abierto (Python/motor propio)                 | Gratis                                                  | Mejor que Tesseract en general, especialmente en detección de layout/tablas                                                                 | Alta: es un servicio Python separado, no encaja naturalmente en el stack Next.js/Node actual — requeriría un microservicio aparte                                                                                |
| **Google Cloud Vision API**                                                                      | Servicio cloud (OCR + detección de documentos)              | Free tier: 1000 unidades/mes gratis, luego pago por uso | Muy buena, incluye modo "document text detection" pensado para facturas/tablas                                                              | Media: SDK oficial, pero requiere cuenta de Google Cloud y tarjeta (aunque el tier gratuito no cobra si no se supera)                                                                                            |
| **Azure AI Document Intelligence (antes Form Recognizer)** — modelo prebuilt "Invoice"/"Receipt" | Servicio cloud especializado en facturas                    | Free tier: 500 páginas/mes (F0)                         | Excelente para facturas: ya devuelve campos estructurados (proveedor, línea de ítem, cantidad, precio) sin que haya que parsear texto plano | Media: requiere cuenta Azure, pero el tier F0 es permanente y gratuito dentro del límite                                                                                                                         |
| **LLM con visión (ej. modelo Claude/GPT con imagen) + prompt de extracción estructurada**        | API de pago por uso (no gratis salvo créditos/trial)        | Variable                                                | Muy buena para interpretar layouts irregulares y normalizar nombres de producto                                                             | Descartado si el requisito es "todo gratuito" en producción continua, salvo que el volumen sea muy bajo y quede dentro de un free tier/trial                                                                     |

**Recomendación por fases:**

1. **Fase 1 (100% gratis y sin dependencias externas): Tesseract.js.**
   - Corre embebido en el propio servidor Next.js (o incluso en el navegador, para no
     cargar el servidor). No hay límites de uso ni cuentas que crear.
   - Limitación esperada: funcionará razonablemente con facturas prolijas/tipeadas, pero
     va a fallar o requerir corrección manual en facturas fotografiadas, torcidas, o con
     tablas complejas. Por eso el resultado del OCR **nunca debe crear productos
     directamente**: siempre pasa por una pantalla de revisión/edición (reutilizando la
     UI de previsualización de la Opción A) antes de confirmar.
   - Mitigar calidad con preprocesamiento de imagen (enderezar, binarizar, aumentar
     contraste) usando `sharp` (librería MIT ya común en proyectos Next.js) antes de
     pasarla a Tesseract — mejora sensiblemente el reconocimiento.

2. **Fase 2 (si la calidad de Fase 1 no alcanza): Azure Document Intelligence F0.**
   - 500 páginas/mes gratis de forma indefinida (no es trial), y el modelo "prebuilt-invoice"
     ya separa campos como ítem, cantidad, precio unitario — mucho menos parsing manual
     que Tesseract.
   - Requiere salir del "100% local" y depender de una cuenta cloud, pero sigue siendo
     gratuito dentro del límite mensual, que para un negocio chico/mediano que carga
     facturas ocasionalmente probablemente alcanza.
   - Se puede dejar como _fallback_ opcional: si Tesseract da baja confianza, ofrecer
     "reintentar con reconocimiento avanzado" (Azure), sin obligar a configurarlo.

3. **Google Cloud Vision** queda como alternativa equivalente a Azure (1000 unidades/mes
   gratis) si por algún motivo se prefiere el ecosistema Google; funcionalmente es
   similar pero sin el modelo especializado en facturas (hay que hacer más parsing manual
   del texto crudo, similar a Tesseract pero con mejor precisión de reconocimiento).

### 3.3 Flujo funcional propuesto

1. Usuario sube imagen/PDF de factura (reutilizar patrón de `ImageUpload` para la subida).
2. Backend (`POST /api/productos/ocr-factura`):
   - Si es PDF, extraer páginas como imagen (ej. `pdf-lib`/`pdf.js`, ambas gratuitas) o,
     si el PDF tiene texto embebido, extraerlo directo sin OCR.
   - Correr Tesseract.js sobre la imagen preprocesada.
   - Heurística de parseo: separar líneas, detectar patrones tipo
     `<descripción> <cantidad> <precio unitario> <subtotal>` usando regex sobre números,
     o alinear por columnas si el layout es tabular.
   - Intentar _matchear_ cada línea extraída contra productos existentes (por nombre
     aproximado — `pg_trgm`/similaridad de texto en Postgres, o una librería tipo
     `string-similarity`, MIT) para sugerir si es un producto ya cargado (solo sumar
     stock) o uno nuevo (crear).
3. Mostrar pantalla de revisión: tabla editable con lo detectado, igual que en la
   Opción A, donde el usuario corrige nombre/cantidad/precio antes de confirmar.
4. Confirmar → mismo pipeline de "importar" de la Opción A (creación/actualización +
   movimiento de stock), reutilizando la lógica de conciliación ya construida.

### 3.4 Riesgos

- Expectativas: el OCR gratuito (Tesseract) **no** va a tener precisión de nivel
  "producción bancaria" en facturas reales de proveedores con formatos heterogéneos.
  Es clave comunicar que el resultado es un _borrador asistido_, no una carga automática
  confiable al 100%.
- Distintos proveedores tienen distintos formatos de factura; una heurística de parseo
  genérica va a fallar con layouts muy variados. Puede valer la pena, a futuro, guardar
  "plantillas de proveedor" (offsets de columnas conocidos) para mejorar precisión con
  proveedores recurrentes — no es necesario para una v1.
- PDFs escaneados como imagen vs. PDFs con texto real requieren rutas de extracción
  distintas; conviene detectar el caso y usar extracción de texto nativa cuando exista
  (más rápido y 100% preciso, sin pasar por OCR).

### 3.5 Costo

- Fase 1 (Tesseract.js + sharp): cero costo, sin cuentas externas.
- Fase 2 (Azure/Google, opcional): cero costo dentro de free tier (500–1000 unidades/mes),
  con riesgo de costo solo si se supera ese volumen — a evaluar según cuántas facturas
  se cargan por mes.

## 4. Resumen de recomendación

|                                   | Opción A: Plantilla Excel                                                                                                                           | Opción B: OCR de facturas                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Esfuerzo de implementación        | Medio (librería + validación + UI de reporte)                                                                                                       | Medio-alto (OCR + heurísticas de parseo + UI de revisión), más si se agrega fallback cloud |
| Confiabilidad                     | Alta (datos estructurados, el usuario los escribe)                                                                                                  | Media (depende de calidad de imagen y formato de factura); requiere revisión humana        |
| Librerías                         | `exceljs` (MIT)                                                                                                                                     | `tesseract.js` (Apache-2.0) + `sharp` (Apache-2.0/BSD) para preprocesar                    |
| Dependencia de servicios externos | Ninguna                                                                                                                                             | Ninguna en Fase 1; opcional (free tier) en Fase 2                                          |
| Reutilización                     | Ambas comparten el mismo pipeline de "previsualizar → validar con Zod → conciliar por sku/código de barra → crear/actualizar + movimiento de stock" | —                                                                                          |

**Sugerencia de orden de implementación:** construir primero el pipeline de importación/
conciliación de la Opción A (exportar plantilla + importar + previsualización + upsert),
porque es la base técnica más simple y confiable. La Opción B (OCR) se apoya en el mismo
pipeline como "otra fuente de filas" además del Excel, así que conviene que ya exista
antes de agregar OCR.

## 5. Preguntas abiertas para definir antes de implementar

1. Al importar/reconocer una fila con `sku`/`codigoBarra` existente: ¿la cantidad se
   **suma** al stock actual o lo **reemplaza**? (impacta el diseño de `movimientoStocks`)
2. ¿La importación crea categorías/subcategorías nuevas automáticamente si el nombre no
   existe, o debe fallar y pedir que coincidan con el catálogo existente?
3. ¿Es necesario soportar múltiples sucursales en un mismo archivo, o cada importación
   es para una sucursal fija (la que el usuario tiene seleccionada)?
4. Para OCR: ¿cuál es el volumen mensual esperado de facturas a procesar? Esto determina
   si alcanza con Tesseract.js solo, o conviene sumar el free tier de Azure/Google desde
   el arranque.
