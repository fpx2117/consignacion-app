# Optimización de prompt/tokens y control de costo por PDFs con varias páginas

Complementa `costos-ocr-ia.md` (mismo change). Responde dos preguntas
puntuales: (1) si hay margen para bajar tokens sin perder calidad de
extracción, y (2) cómo evitar que un PDF con varias páginas/imágenes dispare
el costo muy por encima del promedio usado en la proyección de $1.80/mes
(400 facturas).

## 1. Margen de optimización de prompt y tokens

### 1.1 Ya optimizado (no tocar)

- `OPENROUTER_REASONING_EFFORT=none`: ya evita el gasto de tokens de
  razonamiento (visto en `costos-ocr-ia.md`, punto 2).
- `OPENROUTER_MAX_INPUT_CHARS=12000`: ya pone techo al texto OCR.
- `response_format: json_schema strict`: evita que el modelo "piense en voz
  alta" o devuelva texto de más — la forma de la respuesta viene forzada.

### 1.2 Caching automático del prompt fijo (ya activo, sin cambios de código)

El `systemPrompt` (`buildInvoiceExtractionPrompt` en
`invoice-extraction.config.ts`) y el JSON schema (`buildExpectedOutputSchema`)
son **idénticos en cada llamada** salvo el bloque de contexto de rubro, que
también es fijo por sucursal. OpenAI (y por lo tanto `openai/gpt-4o-mini` vía
OpenRouter) cachea automáticamente el prefijo de prompt repetido entre
llamadas cuando supera ~1024 tokens, y cobra esos tokens cacheados a mitad de
precio. Como el system prompt + schema rondan varios cientos de tokens fijos
y se repiten en el 100% de las facturas, es probable que ya se esté
beneficiando de este descuento sin que hayamos hecho nada especial — no hace
falta reestructurar el prompt para "activarlo", ya está activo por diseño
(mismo texto, mismo orden, en cada request).

**Implicancia práctica:** achicar el texto del system prompt (sacar bullets
redundantes de "NO inventes X") ahorraría poco en $ real, porque esa parte
ya se factura con descuento por caché. El texto que **sí** se paga completo
cada vez, sin descuento, es el que cambia por factura: el texto OCR
(`textoTruncado`) y la imagen. Ahí es donde vale la pena poner el esfuerzo de
optimización (punto 2).

### 1.3 Optimización real disponible: texto OCR truncado de forma más inteligente

Hoy `truncateOcrText()` corta a los primeros `MAX_OCR_TEXT_CHARS` (12.000)
caracteres sin mirar el contenido. Si una factura viene con mucho ruido antes
de la tabla de items (encabezados legales, condiciones de venta, texto de pie
de página repetido), ese ruido compite por el mismo cupo de caracteres que la
tabla de productos. No se propone cambiar esto ahora (agregar heurísticas de
"detectar dónde empieza la tabla" es la clase de complejidad que se descartó
en el diseño original — mantener arquitectura simple), pero queda anotado
como próxima optimización de tokens si en el futuro se ven facturas largas
con ítems cortados por el límite de caracteres.

### 1.4 La imagen es el costo variable más grande

Como se documentó en `costos-ocr-ia.md` punto 5, el costo de tokens de imagen
depende de la resolución (ancho x alto, en tiles), no del peso del archivo.
El ajuste reciente a `prepararImagenParaVision()` (upscaling mínimo a 1600px
de ancho + PNG sin pérdida) mejoró precisión sin subir tokens para el caso de
**una foto de celular** (ej. 739px de ancho, necesita agrandarse para que se
distingan bien las letras). Ese mismo fix tenía un efecto colateral en el
camino de PDF rasterizado — ver `bug-upscale-pdf-rasterizado.md` (documento
propio, ya corregido) para el detalle completo.

## 2. PDF con varias páginas/imágenes: cómo no salirse del presupuesto

### 2.1 Qué pasa hoy

`rasterizarPdf()` (`src/lib/ocr/ocr-engine.ts`) no genera una imagen por
página: renderiza el PDF completo (hasta `maxPaginas = 5` por defecto) como
**una sola captura vertical larga** (`page.screenshot({ fullPage: true })`),
con un viewport de 1240px de ancho × hasta 8000px de alto (`1600 ×
maxPaginas`, tope 8000).

(Esta sección asumía antes que ese ancho ya se agrandaba a 1600px por el fix
de legibilidad de fotos — no era así: era un bug del fix, ya documentado y
corregido aparte en `bug-upscale-pdf-rasterizado.md`. Lo que sigue vale para
el comportamiento ya corregido.)

Un PDF de 3-5 páginas concatenadas en una sola imagen ya tiene muchas más
tiles que una foto de una hoja — y el costo de tokens de imagen escala con
esa cantidad de tiles (`costos-ocr-ia.md`, punto 5). Esto es lo que puede
llevar el costo de una factura puntual muy por encima del promedio de
$0.0045 usado en la proyección de $1.80/mes: esa proyección asume "una
imagen por factura, del tamaño de una foto de WhatsApp" (el caso típico), no
un PDF de varias páginas concatenadas.

### 2.2 Opciones para poner un techo real al costo por documento

> Nota: un efecto colateral relacionado (el fix de legibilidad de fotos
> agrandaba también, sin necesidad, las capturas de PDF rasterizado) ya se
> encontró y corrigió — ver documento propio `bug-upscale-pdf-rasterizado.md`.
> Eso reduce parte del costo de los PDF multi-página, pero no elimina el
> problema de fondo de esta sección (concatenar varias páginas en una sola
> imagen sigue generando más tiles que una foto de una hoja). Las opciones de
> abajo son sobre ese problema de fondo, todavía sin implementar.

| Opción | Cómo limita el costo | Trade-off |
|---|---|---|
| **A. Techo de alto total de imagen** ❌ evaluada, no implementada | Además del ancho (1600px), limitar el **alto máximo** de la imagen final (ej. 2000-2400px), escalando proporcionalmente si el PDF rasterizado da más alto que eso | Sharp escala manteniendo proporción: forzar un techo de alto en una imagen de 1240×8000 la deja en ~372×2400 (escala por el eje más restrictivo) — angostaría demasiado una tabla con varias columnas, perdiendo precisión justo en el caso que más lo necesita. Se descarta por eso. |
| **B. Bajar `maxPaginas` por defecto** ✅ implementado | Menos páginas rasterizadas = imagen final más chica desde el origen, sin tocar la resolución por página | Un comprobante real de más de 2-3 páginas es poco común en facturas de proveedor (vs. remitos largos); si aparece, se corta la captura antes de la página N |
| **C. Mandar solo 1 imagen "representativa" en vez de todas las páginas concatenadas** | Costo de imagen fijo, independiente de cuántas páginas tenga el PDF (siempre 1 imagen a resolución acotada) | La visión deja de poder cotejar páginas 2+ contra el texto — pero el texto OCR ya cubre esas páginas igual; se pierde la corrección visual solo en páginas que no sean la primera |
| **D. Cap de tokens estimados con aviso, no bloqueo** | Usar `promptTokens` que ya devuelve `OpenRouterUsage` (`openrouter-client.ts`) para loguear costo estimado por factura y alertar si un documento puntual se sale mucho del promedio | No evita el gasto, solo lo hace visible — útil para detectar el caso "alguien subió un PDF de 10 páginas" sin haberlo bloqueado antes de que pase |

**B ya está implementado** (`rasterizarPdf(buffer, maxPaginas = 3)` en
`src/lib/ocr/ocr-engine.ts`, antes `5`). Con esto el alto máximo de la
captura concatenada baja de 8000px a 4800px (`1600 × maxPaginas`) sin cambiar
la resolución de cada página individual — la lectura de las páginas que sí
se envían no pierde nada de precisión, solo se manda menos páginas por
documento en el caso (poco común) de un comprobante muy largo.

**A se evaluó y se descartó** explícitamente porque, a diferencia de B,
sí implica perder precisión: al mantener la proporción de aspecto, un techo
de alto fuerza también una reducción de ancho — para una captura muy alta
(varias páginas), eso angostaría la imagen mucho más de lo que
`ANCHO_MINIMO_VISION` intenta garantizar, justo en documentos con tablas de
varias columnas. Se prioriza no perder precisión (pedido explícito) por
sobre acotar el costo al límite absoluto — B ya cubre la mayor parte del
riesgo (documentos de más de 3 páginas son la minoría) sin ese costo en
calidad.

C y D quedan como opciones futuras si B no alcanza en la práctica (a evaluar
con datos reales de uso, no de forma preventiva).

### 2.3 Por qué no conviene un "cap de gasto mensual duro" ($1.80 como techo absoluto)

Una alternativa más agresiva sería: contar cuánto se gastó en el mes y, al
llegar a un monto tope, dejar de mandar imagen (degradar a solo texto) hasta
el mes siguiente. No se recomienda como primera medida porque:

- Convierte un problema de costo predecible en un problema de **calidad
  variable**: las últimas facturas del mes perderían el chequeo visual justo
  cuando más se necesite (fin de mes, más volumen).
- El monto de $1.80/mes para 400 facturas ya es marginal frente a cualquier
  plan pago del sistema — el riesgo real no es gastar de más en OpenRouter,
  sino que **una sola factura mal armada** (PDF de 10 páginas subido por
  error, o un lote grande) dispare un pico puntual. Para eso alcanza con el
  techo por documento (2.2) en vez de un contador mensual global.

Si más adelante se quiere de todos modos un techo mensual duro como red de
seguridad (no como mecanismo normal), se puede agregar después como un
chequeo adicional en `process/route.ts` sin tocar esta lógica — queda
anotado como posible fase futura, no bloqueante.
