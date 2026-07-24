// src/lib/ai/validar-consistencia-factura.ts
// Validación determinística, en código, de lo que devolvió la IA — no reemplaza
// ni depende del `confidence`/`warnings` que el propio modelo reporta (ver
// openspec/changes/mejora-precision-lineas-factura-ocr/design.md, sección
// "Análisis de la arquitectura actual": un caso real mostró confidence=1 en
// líneas con precios desalineados varios miles de pesos).
//
// Nunca reescribe unitCost/quantity/lineTotal — solo agrega advertencias y baja
// (nunca sube) el tope de confidence de las líneas afectadas. La corrección de
// datos sigue siendo responsabilidad exclusiva del usuario en la UI de revisión.

import type { ExtractedInvoiceData } from "@/modules/invoices/config/invoice-extraction.config";

export const TOLERANCIA_CONSISTENCIA_ARITMETICA = 0.01; // 1%, margen para redondeos reales
export const CONFIDENCE_MAXIMA_SI_INCONSISTENTE = 0.5;

export type ResultadoValidacionConsistencia = {
  /** index en ExtractedInvoiceData.items -> advertencias de esa línea puntual. */
  itemsConAdvertencia: Map<number, string[]>;
  /** Advertencias a nivel factura completa (ej. suma de líneas vs total). */
  advertenciasFactura: string[];
  /** index -> tope de confidence a aplicar (nunca sube la confidence original). */
  confidenceMaximaPorItem: Map<number, number>;
};

function difiereMasQueTolerancia(a: number, b: number): boolean {
  const diferencia = Math.abs(a - b);
  const base = Math.max(Math.abs(a), Math.abs(b));
  if (base === 0) return diferencia > 0;
  return diferencia / base > TOLERANCIA_CONSISTENCIA_ARITMETICA;
}

function agregarAdvertencia(
  mapa: Map<number, string[]>,
  index: number,
  mensaje: string,
) {
  const actual = mapa.get(index) ?? [];
  actual.push(mensaje);
  mapa.set(index, actual);
}

/**
 * Corre dos chequeos independientes:
 *
 * 1. Por línea: unitCost * quantity vs lineTotal. Detecta errores de cálculo
 *    dentro de una misma línea. NO detecta el caso donde los tres valores de
 *    una línea son mutuamente consistentes pero los tres vienen "corridos" de
 *    la fila vecina (ver limitación documentada en design.md) — para eso está
 *    el chequeo #2.
 * 2. A nivel factura: suma de lineTotal (o unitCost*quantity si falta
 *    lineTotal) vs invoice.total. Si no cierra, no se puede saber cuál línea
 *    es la culpable sin volver a mirar la imagen, así que se capa la
 *    confidence de TODAS las líneas que no tengan ya un tope más estricto del
 *    chequeo #1 — mejor sobre-advertir que dejar pasar un error real.
 */
export function validarConsistenciaFactura(
  datos: Pick<ExtractedInvoiceData, "items" | "invoice">,
): ResultadoValidacionConsistencia {
  const itemsConAdvertencia = new Map<number, string[]>();
  const confidenceMaximaPorItem = new Map<number, number>();
  const advertenciasFactura: string[] = [];

  datos.items.forEach((item, index) => {
    if (item.unitCost == null || item.lineTotal == null) return;
    const esperado = item.unitCost * item.quantity;
    if (difiereMasQueTolerancia(esperado, item.lineTotal)) {
      agregarAdvertencia(
        itemsConAdvertencia,
        index,
        `Cantidad × precio unitario (${esperado.toLocaleString("es-AR")}) no coincide con el total de línea (${item.lineTotal.toLocaleString("es-AR")})`,
      );
      confidenceMaximaPorItem.set(index, CONFIDENCE_MAXIMA_SI_INCONSISTENTE);
    }
  });

  if (datos.invoice.total != null && datos.items.length > 0) {
    const sumaLineas = datos.items.reduce((acc, item) => {
      if (item.lineTotal != null) return acc + item.lineTotal;
      if (item.unitCost != null) return acc + item.unitCost * item.quantity;
      return acc;
    }, 0);

    if (difiereMasQueTolerancia(sumaLineas, datos.invoice.total)) {
      advertenciasFactura.push(
        `La suma de los items ($${sumaLineas.toLocaleString("es-AR")}) no coincide con el total detectado ($${datos.invoice.total.toLocaleString("es-AR")})`,
      );
      // Se propaga tanto el tope de confidence como una advertencia visible por
      // línea — sin esto último, la UI (que solo marca filas con advertencia
      // propia) no tendría ninguna señal en las líneas afectadas por este
      // chequeo de cabecera, aunque su confidence haya bajado igual.
      datos.items.forEach((_, index) => {
        if (!confidenceMaximaPorItem.has(index)) {
          confidenceMaximaPorItem.set(
            index,
            CONFIDENCE_MAXIMA_SI_INCONSISTENTE,
          );
        }
        if (!itemsConAdvertencia.has(index)) {
          agregarAdvertencia(
            itemsConAdvertencia,
            index,
            "El total de la factura no coincide con la suma de los items detectados — revisar esta línea también, por las dudas",
          );
        }
      });
    }
  }

  return { itemsConAdvertencia, advertenciasFactura, confidenceMaximaPorItem };
}
