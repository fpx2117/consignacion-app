# Evaluación y Métricas — API Central de Catálogo Global

Documento complementario a `proposal.md`/`design.md`/`tasks.md`/`integracion-ocr-kiosco-almacen.md` de este cambio. Sin esto, ninguna decisión de scoring, umbral o cobertura de catálogo se puede validar — se estaría ajustando a ciegas exactamente el mismo problema que motivó `mejora-precision-lineas-factura-ocr` (el modelo reportaba `confidence: 1` sin que nada lo verificara). Este documento define **qué medir, cómo armar el corpus de referencia, cómo capturar señal negativa (no solo confirmaciones), y qué observabilidad mínima hace falta en producción** antes de dar por buena la integración.

## 1. Corpus de referencia (golden set)

**Qué es**: 30-50 facturas reales de proveedores de kiosco/almacén, ya procesadas hoy por el pipeline actual (sin catálogo global), con la corrección manual del usuario ya conocida — es decir, para cada línea se sabe cuál era el texto OCR, qué devolvió la IA, y qué producto es realmente correcto (confirmado por el usuario en la UI o corregido a mano).

**De dónde sale**: no hace falta generarlo desde cero — son facturas que ya pasaron por `factura-proveedor-dialog.tsx` en producción o en pruebas (mismo tipo de fixture que usó `mejora-precision-lineas-factura-ocr` con la factura #46). Se exporta como fixture JSON, similar a los fixtures ya usados en `matching-engine.test.ts`/`normalizar-producto.test.ts`.

**Formato propuesto**:

```typescript
// src/lib/ai/__fixtures__/corpus-kiosco-almacen.ts (nuevo)

export type CasoReferencia = {
  id: string; // ej. "factura-46-linea-3"
  rubro: "kiosco" | "almacen";
  textoOcr: string; // ej. "LATA IMPERIAL *IPA* 24X473"
  productoCorrectoId: number | null; // id en Producto local, si el negocio lo tenía cargado; null si no existía y debía crearse
  nombreCorrectoEsperado: string; // ej. "Imperial IPA Lata 473 ml" — para casos sin Producto local todavía
  resultadoEsperado: "match_local" | "match_global" | "sin_match_esperado"; // sin_match_esperado: casos donde ni local ni global deberían encontrar nada (producto genuinamente nuevo/raro)
};

export const CORPUS_KIOSCO_ALMACEN: CasoReferencia[] = [
  // ...30-50 casos reales
];
```

**DEBE** incluir casos de los tres tipos, no solo los que "deberían" matchear:
- Casos donde el catálogo local ya resuelve (para confirmar que agregar candidatos globales no empeora ni interfiere con lo que ya funcionaba).
- Casos donde solo el catálogo global puede resolver (el caso de uso central de esta propuesta).
- Casos donde ni local ni global deberían encontrar nada — para medir falsos positivos (candidato global de alto score mal aplicado a un producto que no existe en el catálogo).

## 2. Métricas a calcular contra el corpus

Correr el corpus contra el pipeline (con y sin candidatos globales) y calcular:

| Métrica | Definición | Por qué importa |
|---|---|---|
| **Hit rate global** | % de líneas con `resultadoEsperado: match_global` donde el candidato correcto apareció en el top-3 devuelto por `POST /catalogo/ocr-candidatos` | Mide si el catálogo/scoring de la API central sirve, antes de siquiera llegar a la IA |
| **Precisión del top-1** | De las líneas donde el candidato correcto apareció, % donde además fue el candidato con mayor score (no un candidato #2 o #3 correcto tapado por uno incorrecto con score más alto) | Si el top-1 no es confiable, el desempate (punto 4 de `integracion-ocr-kiosco-almacen.md`) está mal calibrado |
| **Tasa de falsos positivos** | % de líneas `sin_match_esperado` donde igual se devolvió un candidato con score alto (ej. > 80) | Mide sobre-confianza del scoring — un score alto en un producto que no corresponde es peor que no devolver nada, porque induce a la IA a "inventar con respaldo aparente" |
| **Mejora neta end-to-end** | % de líneas donde el resultado final de `procesarFacturaConIA()` (con candidatos globales) coincide con `nombreCorrectoEsperado`, comparado contra el mismo % sin candidatos globales | La métrica que realmente importa — las anteriores son diagnóstico, esta es la que decide si el cambio se despliega |
| **Regresión en casos ya resueltos localmente** | % de líneas `match_local` donde el resultado sigue siendo correcto con candidatos globales agregados al prompt | Confirma que agregar una tercera fuente no degrada lo que ya funcionaba (riesgo real: más candidatos en el prompt pueden confundir al modelo incluso cuando el catálogo local ya tenía la respuesta) |

**DEBE** correrse este cálculo antes de activar `CATALOGO_API_URL` en cualquier instancia de producción (bloquea la tarea 2.10 de `tasks.md`) y **DEBERÍA** volver a correrse cada vez que cambie el scoring de la API central o el CSV del catálogo piloto, para detectar regresiones.

## 3. Calibración del score, no solo su existencia

El score 0-100 devuelto por `POST /catalogo/ocr-candidatos` (ver `design.md`) es hoy una fórmula de similitud trigram sin significado externo. Antes de usarlo como umbral de decisión (ej. "solo mostrar candidatos con score > 70"):

1. Correr el corpus completo y graficar score devuelto vs. si ese candidato era el correcto (histograma de aciertos/errores por bucket de score: 0-20, 20-40, ..., 80-100).
2. **DEBE** elegirse el umbral de "candidato confiable para preferir sin revisión" en base a ese histograma, no a una intuición — ej. si el bucket 80-100 tiene 95% de aciertos en el corpus pero el bucket 60-80 tiene solo 60%, el umbral real de confianza es 80, no un número redondo elegido a priori.
3. Este umbral **DEBERÍA** re-calibrarse cuando el catálogo piloto crezca más allá del CSV inicial (más productos = distribución de scores distinta, especialmente si aparecen productos muy parecidos entre sí que antes no competían por el mismo texto).

## 4. Señal negativa: capturar el rechazo, no solo la confirmación

`design.md` (Decisión 5) ya define que al confirmar un candidato global se persiste `ProductoProveedorAlias.productoGlobalId` — pero no existe ningún registro de cuándo el usuario **rechaza** un candidato global sugerido y corrige a mano. Sin esa señal negativa, un candidato mal rankeado para un texto frecuente sigue apareciendo indefinidamente, porque nada le indica al sistema que estuvo mal.

**Propuesta mínima, sin tabla nueva**: extender el log estructurado ya existente (mismo patrón `console.log("[OpenRouter]", {...})` de `openrouter-client.ts:161`) con un evento grepeable en el momento de confirmación de item:

```typescript
// en el flujo de confirmación de FacturaProveedorItem (process/route.ts o el endpoint de confirmación)

console.log("[CatalogoGlobal] resolución de línea", {
  facturaId,
  itemId,
  candidatoGlobalSugeridoId: candidato?.id ?? null,
  candidatoGlobalSugeridoScore: candidato?.score ?? null,
  productoFinalConfirmadoId: productoConfirmado.id,
  coincidio: candidato?.id === productoConfirmado.productoGlobalId, // false = el usuario corrigió/rechazó la sugerencia
});
```

**DEBE** quedar grepeable en los logs de producción (mismo criterio que el punto 14 de `rubro-contexto-ocr`: "sin tabla ni dashboard nuevo, solo grepeable... para poder ajustar con datos reales"), sin necesidad de una tabla de feedback dedicada en esta primera iteración. Si el volumen de rechazos es alto una vez en producción, ahí sí se justifica una tabla (`RETROALIMENTACION_MATCH` o similar) — pero no se construye antes de tener evidencia de que hace falta.

**Fuera de alcance explícito**: enviar esta señal negativa de vuelta a la API central para que ajuste el catálogo global entre negocios. Ya está descartado por privacidad en `proposal.md` ("Fuera del Alcance", punto sobre no enviar correcciones de vuelta) — el log es solo para diagnóstico local de esta instancia.

## 5. Desempate de candidatos con score similar

`integracion-ocr-kiosco-almacen.md` (sección 6) deja explícito que la IA no debe "adivinar" variante/sabor cuando el texto no la menciona. Falta la regla concreta para cuando dos candidatos empatan en score dentro de un margen (ej. diferencia < 5 puntos):

**DEBE** aplicarse esta regla, en orden, antes de mandarle candidatos a la IA:
1. Si uno de los empatados matchea la presentación parseada (`parsearNotacionPack()`, sección 4 de `integracion-ocr-kiosco-almacen.md`) y el otro no, gana el que matchea.
2. Si siguen empatados, **NO DEBE** elegirse ninguno automáticamente — se mandan ambos (máximo 2-3) a la IA con una instrucción explícita en el prompt: "si dos candidatos son igualmente probables y el texto no distingue cuál, marcar `requiere_revision: true` en vez de elegir uno al azar".
3. El resultado de un empate no resuelto **DEBE** quedar visible en la UI de revisión como tal (no como una elección silenciosa) — mismo patrón ya usado para advertencias de línea en `mejora-precision-lineas-factura-ocr`.

## 6. Presupuesto de candidatos/tokens por línea

Sin tope, cada línea de factura suma el costo de N candidatos globales al prompt. **DEBE** limitarse a top-3 candidatos globales por línea (no los 10 que devuelve el endpoint por default) antes de armar el prompt — los primeros 3, ya ordenados por score, cubren el caso de uso real (elegir el correcto o detectar ambigüedad); candidatos 4-10 casi nunca aportan y sí suman tokens en cada llamado a OpenRouter. Este recorte se hace en `catalogo-global-client.ts` o en el paso de armado de prompt, no en la API central (que sigue devolviendo hasta `limit` para otros consumidores futuros del endpoint).

## 7. Observabilidad mínima en producción

Además del log de resolución de línea (punto 4), agregar al mismo log estructurado (o uno separado por request a la API central):

```typescript
console.log("[CatalogoGlobal] consulta", {
  rubro,
  timedOut: boolean,       // distingue timeout de "respondió pero sin candidatos"
  candidatosDevueltos: number,
  elapsedMs: number,
});
```

Esto permite, con solo grep sobre logs de Railway (mismo patrón que el resto del proyecto, sin dashboard nuevo):
- Separar "la API central está caída/lenta" (`timedOut: true`, requiere atención de infraestructura) de "el catálogo no tiene ese producto" (`timedOut: false, candidatosDevueltos: 0`, requiere ampliar el CSV, no arreglar infraestructura) — dos problemas con solución distinta que hoy quedarían indistinguibles bajo el mismo fallback silencioso a `[]` (`design.md`, Decisión 4).
- Calcular, ya en producción real (no solo en el corpus offline), la tasa de uso efectivo de candidatos globales por rubro, para decidir cuándo expandir el CSV a un rubro nuevo (Fase 3 de `tasks.md`).

## 8. Criterio de éxito, ahora medible

Con lo anterior, el criterio de éxito de `proposal.md` deja de ser cualitativo. Antes de expandir de kiosco/almacén (piloto) a otro rubro:

1. Mejora neta end-to-end (punto 2) **DEBE** ser positiva y estadísticamente perceptible en el corpus (no un solo caso anecdótico como la factura #46).
2. Tasa de falsos positivos (punto 2) **DEBE** ser menor al 5% en el corpus — un score alto en un producto incorrecto es peor que no sugerir nada.
3. Regresión en casos ya resueltos localmente (punto 2) **DEBE** ser 0% — agregar la tercera fuente no puede romper lo que ya funcionaba.
4. Al menos una semana de datos de producción real (punto 7) sin señales de que la API central sea un cuello de botella de latencia (`elapsedMs` p95 dentro del timeout configurado, sin necesidad de subirlo).

## Tareas nuevas para `tasks.md`

No se listan acá como fase aparte para no duplicar el archivo — se agregan como tareas de la Fase 2, antes de la 2.10 (verificación end-to-end), ya que la evaluación offline con el corpus debe pasar antes de esa verificación en producción:

- Armar `corpus-kiosco-almacen.ts` (30-50 casos reales, los 3 tipos de resultado esperado).
- Script de evaluación que corre el corpus contra el pipeline con/sin candidatos globales y calcula las métricas de la sección 2.
- Calibrar el umbral de score (sección 3) contra el histograma real del corpus.
- Agregar los logs estructurados de las secciones 4 y 7.
- Implementar el tope de top-3 candidatos (sección 6) y la regla de desempate (sección 5).
