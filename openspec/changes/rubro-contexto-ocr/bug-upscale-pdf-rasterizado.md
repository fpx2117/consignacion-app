# Bug: el fix de legibilidad de fotos también agrandaba (sin necesidad) los PDF rasterizados

## Resumen

El fix aplicado para el problema de confusión N/W/M en OCR/visión (upscaling
mínimo a 1600px de ancho en `prepararImagenParaVision()`, ver
`design.md`/`tasks.md` de este change) se escribió pensando únicamente en el
camino de "foto de celular". Al revisar el documento de costos
(`optimizacion-tokens-y-limite-costo.md`) se detectó que ese mismo fix
también afectaba, sin querer, al camino de PDF escaneado rasterizado por
Chromium — encareciéndolo en tokens sin ninguna mejora de legibilidad a
cambio. Ya corregido (ver "Fix aplicado" más abajo).

## Contexto: por qué existía el upscale mínimo

`prepararImagenParaVision()` (`src/lib/ocr/ocr-engine.ts`) prepara la imagen
que se manda al modelo de visión de OpenRouter. Se detectó con una factura
real (foto de WhatsApp, 739×563px) que el modelo confundía letras similares
("RASASI HAWAS" leído como "RASAST HAMAS/HANAS"). La causa: una imagen de
celular ya chica y comprimida, a la que además se le aplicaba una segunda
compresión JPEG con pérdida, quedaba sin trazos finos suficientes para
distinguir N/W/M. El fix: si el ancho es menor a `ANCHO_MINIMO_VISION`
(1600px), agrandar antes de mandar; y usar PNG sin pérdida en vez de
recomprimir en JPEG.

## El bug

Esa misma función también se usa para el camino de **PDF escaneado sin texto
nativo**: `extraer-texto-factura.ts` llama a `rasterizarPdf()` (que renderiza
el PDF con Chromium a `1240px` de ancho, no 1600) y el resultado se pasa,
sin distinción, por `prepararImagenParaVision()`.

Como `1240 < ANCHO_MINIMO_VISION (1600)`, la condición de upscale se
disparaba también acá — agrandando la captura de Chromium de 1240px a
1600px de ancho (~29% más grande), y por lo tanto también su alto en la
misma proporción (`sharp().resize({ width })` sin alto explícito mantiene la
relación de aspecto). Para un PDF de varias páginas, cuyo alto ya puede
llegar a 8000px (`rasterizarPdf(buffer, maxPaginas=5)` usa un viewport de
hasta `1600 × maxPaginas`), el resultado final terminaba en hasta
~1600×10.320px.

El problema: una captura de Chromium **no tiene el problema que motivó el
fix**. Es un render vectorial de un PDF, ya nítido de por sí — no es una
foto de celular comprimida por una cámara y por WhatsApp. Agrandarla no
mejora nada la legibilidad para el modelo de visión, pero sí aumenta la
cantidad de tiles de la imagen, y el costo de tokens de imagen en
OpenRouter/OpenAI escala con esa cantidad de tiles (ver
`costos-ocr-ia.md`, punto 5). Es decir: el fix de un problema (letras
confundidas en fotos) estaba encareciendo, sin ningún beneficio, un camino
distinto (PDFs escaneados), justo el que ya es más caro por naturaleza al
concatenar varias páginas en una sola imagen.

## Impacto

- Camino afectado: PDF de proveedor sin texto nativo (escaneado), cualquier
  cantidad de páginas.
- No afectaba al camino de foto/imagen subida directamente (ese sí necesita
  el upscale, y se comporta como estaba previsto).
- No rompía la extracción ni la precisión — el resultado seguía siendo
  correcto, solo más caro en tokens de lo necesario.

## Fix aplicado

`prepararImagenParaVision()` ahora acepta un segundo parámetro opcional:

```ts
export async function prepararImagenParaVision(
  buffer: Buffer,
  opciones: { permitirUpscale?: boolean } = {},
): Promise<Buffer>;
```

- Default `permitirUpscale: true` — mantiene el comportamiento original para
  el camino de foto/imagen (`extraer-texto-factura.ts`, rama
  `esImagenSoportada`).
- El camino de PDF rasterizado pasa explícitamente `permitirUpscale: false`:

```ts
// extraer-texto-factura.ts
prepararImagenParaVision(imagenParaOcr, { permitirUpscale: false });
```

Con esto, la captura de Chromium se manda a su ancho real (1240px, o
recortada a `ANCHO_MAXIMO_VISION`=1600px si algún día el viewport cambiara a
algo más ancho), sin el agrandado innecesario. El camino de foto sigue
agrandando imágenes angostas como antes, preservando el fix de N/W/M.

## Archivos tocados

- `src/lib/ocr/ocr-engine.ts` — parámetro `permitirUpscale` en
  `prepararImagenParaVision()`.
- `src/lib/ocr/extraer-texto-factura.ts` — pasa `permitirUpscale: false` en
  la rama de PDF rasterizado.

## Relación con otros documentos de este change

- `costos-ocr-ia.md`: explica por qué el costo de imagen depende de
  resolución, no de bytes (la base de por qué este bug importaba en $).
- `optimizacion-tokens-y-limite-costo.md`: contiene el resto del análisis de
  costo de PDFs multi-página (opciones A/B/C/D de la sección 2.2) — este
  fix es la opción "A0" de esa tabla, ya resuelta acá.
