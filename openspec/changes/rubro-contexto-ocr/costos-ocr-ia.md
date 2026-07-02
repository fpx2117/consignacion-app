# Costos de OpenRouter (prompt + imagen) — OCR de facturas de proveedor

Este documento junta los números de costo/latencia que fuimos midiendo durante
la implementación del pipeline OCR + IA (ver `design.md` y `proposal.md` de
este mismo change), para tener una referencia única de cuánto sale procesar
facturas según el camino que toman.

## 1. Dos caminos, dos costos distintos

| Camino | Qué se manda al modelo | Modelo usado |
|---|---|---|
| PDF con texto nativo (factura electrónica) | Solo texto (ya 100% confiable, sin OCR) | `OPENROUTER_MODEL` |
| Foto o PDF escaneado | Texto OCR local (Tesseract) **+ imagen original**, siempre juntos | `OPENROUTER_VISION_MODEL` |

Con vision-always (decisión confirmada: "mandar siempre texto+imagen para
fotos"), **todo** documento que sea foto o escaneo paga el costo de imagen,
no solo cuando el OCR local salió con baja confianza. La razón: la confianza
es una métrica del documento completo, y puede esconder una sola línea mal
leída (precio o cantidad) que a nivel de promedio no se nota — perder ese
dato vale más que los centavos extra de mandar la imagen.

## 2. Por qué `openai/gpt-4o-mini` y no `qwen3.6-35b-a3b`

Medido contra la misma factura real (15 ítems, mismo texto de Tesseract para
ambos modelos, solo texto — sin imagen):

| Modelo | Tiempo | Costo por factura |
|---|---|---|
| qwen3.6-35b-a3b | 58s | $0.00156 |
| **openai/gpt-4o-mini** | 8.9s | **$0.00056** |

gpt-4o-mini fue 6.5x más rápido y 3x más barato con el mismo input — la
lentitud que se venía reportando era del modelo, no del pipeline de OCR
local. Por eso se usa gpt-4o-mini tanto para `OPENROUTER_MODEL` (texto-only)
como para `OPENROUTER_VISION_MODEL` (texto+imagen).

Adicionalmente, `OPENROUTER_REASONING_EFFORT=none`: con reasoning activado
(incluso "low"), una factura de 20 ítems tardaba 100-145s quemando miles de
tokens "pensando" para una tarea que no lo necesita (el `json_schema strict`
ya fuerza la forma de la respuesta). Sin reasoning, mismo resultado en ~50s.

## 3. Costo extra de mandar la imagen

Medido comparando el mismo documento con y sin imagen adjunta:

| Camino | Costo por factura |
|---|---|
| Solo texto | $0.0006 – $0.0016 |
| Texto + imagen (vision) | ~$0.0045 |

Es decir, la imagen agrega entre 3x y 7x el costo de una llamada solo-texto,
pero en términos absolutos sigue siendo centavos de dólar. Proyección hecha
en su momento: **400 facturas escaneadas/mes ≈ $1.82 USD/mes** (a ~$0.00455
por factura).

## 4. Medición real más reciente (factura de 17 ítems, con imagen)

Test contra una foto real de celular (RASASI/LATTAFA/MAISON ALHAMBRA, 17
líneas), con vision-always activo:

| Métrica | Valor |
|---|---|
| Tokens totales por llamada | ~30.400 – 30.500 |
| Tokens de razonamiento | 0 (reasoning "none") |
| Latencia total (OCR local + llamada a OpenRouter) | 23s – 40s* |
| Modelo | openai/gpt-4o-mini |

\* La variación de latencia salió del tamaño del archivo de imagen enviado
(ver punto 5), no del texto — el conteo de tokens fue prácticamente
idéntico entre ambas corridas.

## 5. El cambio de compresión de imagen no afecta el costo en tokens

Como parte de esta misma investigación se corrigió `prepararImagenParaVision()`
(`src/lib/ocr/ocr-engine.ts`) para dejar de re-comprimir la imagen como JPEG
calidad 80 (que borroneaba caracteres parecidos entre sí, ej. N/W confundidas)
y en cambio: agrandar las imágenes angostas (<1600px) igual que ya se hace
para Tesseract, y mandar PNG sin pérdida en vez de JPEG.

Esto aumenta el peso del archivo transmitido, pero **el costo de tokens de
imagen en OpenRouter/OpenAI se calcula por resolución, no por bytes** — se
confirmó empíricamente: la misma factura de 17 ítems consumió prácticamente
los mismos tokens totales (30.364 contra 30.528) antes y después del cambio,
mientras la latencia subió unos 17s solo por transferir un archivo más
pesado. Es decir, se ganó precisión (ya no confunde letras) sin pagar más
por token.

## 6. Proyección por volumen mensual

Usando los costos por factura medidos (punto 2 y 3), separando por tipo de
documento predominante:

| Facturas/mes | Todo texto ($0.0006–0.0016 c/u) | Todo vision ($0.0045 c/u) |
|---|---|---|
| 100 | $0.06 – $0.16 | $0.45 |
| 400 | $0.24 – $0.64 | $1.80 |
| 1.000 | $0.60 – $1.60 | $4.50 |
| 5.000 | $3.00 – $8.00 | $22.50 |

En la práctica el gasto real queda entre ambas columnas, según qué proporción
de facturas de proveedor lleguen como PDF con texto nativo (más barato) vs.
como foto/escaneo (vision, más caro) — la mayoría de los proveedores mandan
foto por WhatsApp, así que conviene presupuestar más cerca de la columna
"todo vision".

## 7. Variables de entorno relevantes para el costo

- `OPENROUTER_MODEL` / `OPENROUTER_VISION_MODEL`: default `openai/gpt-4o-mini`
  en ambos casos (ver punto 2).
- `OPENROUTER_REASONING_EFFORT`: default `none` — activar `low`/`medium`/`high`
  multiplica el costo y la latencia varias veces sin mejorar la precisión de
  esta tarea (punto 2).
- `OPENROUTER_MAX_INPUT_CHARS`: default `12000` — techo de caracteres del
  texto OCR que se manda al modelo, para que una factura anormalmente larga
  no dispare el costo de tokens de texto sin límite.
