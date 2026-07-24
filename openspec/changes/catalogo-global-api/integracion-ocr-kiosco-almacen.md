# Integración OCR + IA para reconocimiento de productos — Rubros Kiosco y Almacén

Documento complementario a `proposal.md`/`design.md` de este cambio. Enfoque acotado: **cómo** se integra la API central de catálogo global con el pipeline de OCR+IA existente, específicamente para los dos rubros con mayor volumen esperado de facturas (`kiosco`, `almacen`, ya definidos en `src/modules/invoices/config/rubros.ts`). No repite el diseño general de la API central (eso está en `design.md`) — se concentra en las particularidades de estos dos rubros: qué los hace distintos para OCR, qué dato es más confiable en cada uno, y cómo se ordena la búsqueda de candidatos para ellos.

## 1. Por qué kiosco/almacén primero

Son los dos rubros con:

- **Mayor proporción de productos con código de barras real** (EAN-13 impreso en el empaque) — a diferencia de indumentaria, ferretería o servicios, donde el código de barras suele ser interno del negocio o no existir.
- **Catálogo más estable entre negocios distintos**: una Coca-Cola de 2.25L es el mismo producto en cualquier kiosco del país. En rubros como indumentaria o decoración, el "mismo nombre" puede ser un producto distinto en cada local (sin SKU universal).
- **Fuentes públicas ya existentes y gratuitas** que cubren casi exactamente este universo: Precios Claros (Secretaría de Comercio) y Open Food Facts tienen su mayor cobertura justo en alimentos, bebidas, limpieza y almacén — no en ferretería o indumentaria.

Por estas tres razones, kiosco/almacén es el rubro piloto natural para el scraper de Precios Claros (tareas 1.9-1.13 de `tasks.md`, ver `design.md` Decisión 6) y para calibrar el scoring antes de expandir a otros rubros (Fase 3).

## 2. Qué rompe hoy el OCR en este rubro, específicamente

Patrones de error reales observados (ver ejemplos en `proposal.md`), categorizados para saber qué mitigación aplica a cada uno:

| Patrón                                                  | Ejemplo                                                                       | Causa                                                                                                                                          | Mitigación                                                                                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Notación de pack/multiplicación                         | `COCA-COLA 8x2,25`                                                            | El proveedor factura "8 unidades de 2.25L" en una sola línea abreviada; la coma decimal se confunde con separador de miles en el prompt actual | Parseo de presentación como parte del candidato global (sección 4) — no depende de que el modelo "adivine" qué significa `8x2,25` |
| Asteriscos/mayúsculas de sistemas de facturación viejos | `LATA IMPERIAL *IPA* 24X473`                                                  | Sistemas de punto de venta de proveedores usan `*` para resaltar variante                                                                      | `normalizeText()` ya limpia esto (sección 3) antes de comparar                                                                    |
| Abreviaturas de unidad OCR-corrompidas                  | `armaf odyssey go manco edp io0nl` (`io0nl` → `100ml`)                        | El OCR confunde `1`/`i`, `0`/`o` en fuentes chicas de ticket térmico                                                                           | Reglas de post-corrección específicas de unidad (sección 3) — no genéricas de texto                                               |
| Nombre de marca mal transcripto                         | `lattafa` → debería ser `lattafa` (marca real) pero a veces aparece `lataffa` | Error de tipeo del cajero/proveedor al cargar el ticket, no del OCR de imagen                                                                  | Búsqueda por alias + trigram tolera esto sin regla ad-hoc (candidato global ya lo resuelve por similitud)                         |

La distinción importante: no todos los errores son "de OCR de imagen" — varios ejemplos (`8x2,25`, `lataffa`) vienen de cómo el proveedor mismo abrevia en su propio sistema de facturación, texto que luego se lee perfectamente bien pero significa algo no evidente. Por eso la mitigación no es "mejorar el OCR", es darle al modelo (y al matching) una referencia real de productos para comparar.

## 3. Normalización específica de kiosco/almacén, antes del matching

Además de `normalizeText()` (genérico, ya definido en `design.md`), para estos dos rubros conviene una segunda pasada **específica de presentación de producto envasado**, aplicada tanto en la API central (al indexar) como en el cliente (al preparar la query):

```typescript
// src/lib/ai/normalizar-ocr-kiosco-almacen.ts (nuevo, opcional — ver sección 6 sobre alcance)

const CORRECCIONES_OCR_UNIDAD: Array<[RegExp, string]> = [
  [/\bi0+ml\b/g, "100ml"],
  [/\bio0ml\b/g, "100ml"],
  [/\bl00ml\b/g, "100ml"],
  [/\b(\d+)o\b(?=\s*(ml|g|kg|l))/g, "$1"], // "1000" leído "1oo0" → normaliza el "o" final antes de la unidad
];

export function normalizarPresentacionOcr(texto: string): string {
  let resultado = normalizeText(texto);
  for (const [patron, reemplazo] of CORRECCIONES_OCR_UNIDAD) {
    resultado = resultado.replace(patron, reemplazo);
  }
  return resultado;
}

/**
 * Extrae la notación "8x2,25" / "24x473" (pack x presentación) como dato
 * estructurado, en vez de dejarla como texto libre para que la IA la interprete.
 */
export function parsearNotacionPack(
  texto: string,
): { cantidadPack: number; presentacionUnidad: string } | null {
  const match = texto.match(/(\d+)\s*x\s*(\d+[.,]?\d*)/i);
  if (!match) return null;
  return {
    cantidadPack: Number(match[1]),
    presentacionUnidad: match[2].replace(",", "."),
  };
}
```

**Por qué esto es un módulo aparte y no una extensión de `normalizeText()` genérica**: `normalizeText()` (usada por todos los rubros) no debe asumir que "8x2,25" es una notación de pack — en ferretería, `8x2,25` podría ser una medida (8mm x 2.25mm). El parseo de notación de pack es una heurística válida solo para productos envasados por unidades, así que vive separado y se invoca condicionalmente cuando `rubro` es `kiosco`/`almacen`/`supermercado`/`mayorista` (los cuatro rubros de `rubros.ts` con "pack"/"cantidad por pack" en `atributosTipicos`).

## 4. Candidato global enriquecido: no solo nombre, también presentación estructurada

El endpoint `POST /catalogo/ocr-candidatos` (definido en `design.md`) para estos rubros debería devolver, además del nombre normalizado, la presentación ya separada en campos parseables — así la IA no tiene que volver a inferir "2.25 L" de un string libre:

```json
{
  "candidatos": [
    {
      "id": "prod_global_001",
      "codigoBarras": "7790895000998",
      "nombreNormalizado": "Coca-Cola Sabor Original",
      "marca": "Coca-Cola",
      "presentacion": { "valor": 2.25, "unidad": "L" },
      "packDefault": null,
      "categoria": "Bebidas",
      "subcategoria": "Gaseosas",
      "score": 94
    }
  ]
}
```

Cuando el texto OCR trae `parsearNotacionPack()` con resultado (`{cantidadPack: 8, presentacionUnidad: "2.25"}`), el cliente HTTP (`catalogo-global-client.ts`) compara `presentacionUnidad` contra `candidato.presentacion.valor` como **filtro de desempate**, no de búsqueda: si dos candidatos "Coca-Cola" existen (2.25L y 1.5L), el que matchea la presentación detectada en el texto sube de score antes de llegar al prompt de la IA. Esto reduce el trabajo de la IA a "elegir entre pocos candidatos ya pre-filtrados por presentación", en vez de "leer un string y deducir la presentación desde cero" — que es exactamente donde ocurrió el error real documentado en `mejora-precision-lineas-factura-ocr` (precio/cantidad de una fila mezclado con otra).

## 5. Orden de resolución para una línea de factura en kiosco/almacén

Mismo orden general que el resto del sistema (local → alias de proveedor → global), con una particularidad: **si el texto OCR trae un código de barras legible (EAN-13, 13 dígitos), ese código se usa primero y se salta directamente a lookup exacto**, sin pasar por scoring de texto en ningún nivel:

```
1. ¿El texto de la línea o una columna aparte trae un código de barras de 13 dígitos?
   Sí → GET /catalogo/barcode/:codigo (API central) + buscar Producto local por codigoBarras
        → si hay match exacto en cualquiera de los dos, listo, no hace falta scoring de texto.
   No → seguir a 2.

2. Buscar en Producto local (catálogo del propio negocio) por nombre normalizado.
3. Buscar en ProductoProveedorAlias (texto ya visto de este proveedor).
4. Si 2 y 3 no dieron resultado suficiente:
   a. parsearNotacionPack() sobre el texto OCR (sección 3).
   b. POST /catalogo/ocr-candidatos con rubro=kiosco|almacen + descripción + presentación parseada.
   c. Candidatos globales entran al prompt de la IA junto con lo que haya de 2/3 (aunque sea vacío).
```

Esto es una extensión concreta del flujo ya descrito en `design.md` (sección "Secuencia completa"), específica para estos rubros: el atajo de código de barras (paso 1) no aplica igual en rubros sin EAN real (ej. indumentaria, donde el "código" suele ser un SKU interno del proveedor, no universal) — por eso vive documentado acá y no en el diseño genérico.

## 6. Qué NO conviene meter en el prompt de la IA para estos rubros

Con candidatos ya pre-filtrados y con presentación estructurada (sección 4), el prompt para kiosco/almacén **no necesita** pedirle a la IA que:

- calcule conversiones de unidad (ej. "2250ml = 2.25L") — eso ya lo resuelve el parseo estructurado antes de llegar al modelo;
- elija entre variantes de sabor/línea cuando el texto OCR no las menciona — si el texto dice solo "COCA-COLA" sin más detalle, ningún candidato debería preferirse sobre otro por sabor; el modelo debe marcar `requiere_revision: true` en vez de adivinar (mismo principio ya vigente: "no inventar", ver `invoice-extraction.config.ts`);
- resolver por sí sola la notación `8x2,25` como texto libre — es una tarea de parseo determinístico (sección 3), no de lenguaje natural, y dejarla en manos del modelo es precisamente el tipo de ambigüedad que causó el bug documentado en `mejora-precision-lineas-factura-ocr`.

## 7. Fuentes de datos: qué priorizar en la heurística de clasificación del scraper

El scraper de Precios Claros (tareas 1.9-1.13 de `tasks.md`, ver `design.md` Decisión 6) trae todo lo que encuentra en las sucursales elegidas, sin filtrar por categoría de antemano — la heurística de clasificación por keywords (tarea 1.12) es la que decide qué le llega a cada rubro. Orden de prioridad para armar/afinar esas keywords, en base a qué se ve más seguido en facturas de proveedor de kiosco/almacén:

1. Gaseosas y aguas (pocas marcas, muchas presentaciones — alto volumen de facturación, bajo esfuerzo de mantener la lista de keywords).
2. Cervezas (mismo patrón: pocas marcas, notación de pack frecuente como en el ejemplo `LATA IMPERIAL *IPA* 24X473`).
3. Snacks/golosinas (muchas marcas, pero nombres cortos y estables).
4. Almacén seco (harinas, aceites, enlatados) — mayor variedad de marca/presentación, más ambigüedad para la heurística de keywords.
5. Limpieza básica (si el negocio también factura estos ítems mezclados, cosa común en kiosco/almacén chico).

Esto no es una tarea nueva respecto a `tasks.md` — es el criterio concreto para priorizar qué keywords cubrir primero en la tarea 1.12 y qué revisar primero al validar el resultado de la primera corrida del cron (tarea 1.17).

## 8. Ejemplo end-to-end con los datos reales de `proposal.md`

Texto OCR: `LATA IMPERIAL *IPA* 24X473`, rubro `kiosco`.

1. Sin código de barras legible en el texto → no aplica atajo de la sección 5.1.
2. Sin match en `Producto` local (negocio de prueba sin este producto cargado, mismo caso documentado en `mejora-precision-lineas-factura-ocr`).
3. Sin `ProductoProveedorAlias` previo para este proveedor.
4. `parsearNotacionPack("LATA IMPERIAL *IPA* 24X473")` → `{ cantidadPack: 24, presentacionUnidad: "473" }`.
5. `POST /catalogo/ocr-candidatos` con `{ rubro: "kiosco", descripcion: "LATA IMPERIAL *IPA* 24X473", presentacionHint: 473 }` → la API central filtra por rubro, matchea "imperial" + "ipa" por trigram, y desempata por `presentacion.valor === 473` → devuelve `Imperial IPA Lata 473 ml` con score alto.
6. El candidato entra al prompt ya con presentación resuelta — la IA solo tiene que confirmar que "Imperial IPA Lata 473 ml" es una lectura razonable de "LATA IMPERIAL _IPA_ 24X473", no inferir de cero qué es "473".
7. Usuario confirma → se persiste `ProductoProveedorAlias` con `productoGlobalId` (ver `design.md`, Decisión 5) → la próxima factura del mismo proveedor con este texto exacto resuelve en el paso 3, sin volver a llamar a la API central.
