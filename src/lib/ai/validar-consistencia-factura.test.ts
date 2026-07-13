import assert from "node:assert/strict";
import test from "node:test";
import {
  validarConsistenciaFactura,
  CONFIDENCE_MAXIMA_SI_INCONSISTENTE,
} from "@/lib/ai/validar-consistencia-factura";
import type { ExtractedInvoiceData } from "@/modules/invoices/config/invoice-extraction.config";

function item(overrides: Partial<ExtractedInvoiceData["items"][number]>): ExtractedInvoiceData["items"][number] {
  return {
    rawDescription: "Item",
    supplierCode: null,
    quantity: 1,
    unitCost: null,
    lineTotal: null,
    confidence: 1,
    extraAttributes: [],
    ...overrides,
  };
}

test("factura consistente no genera ninguna advertencia", () => {
  const datos: Pick<ExtractedInvoiceData, "items" | "invoice"> = {
    invoice: { number: null, date: null, currency: "ARS", total: 100 },
    items: [
      item({ quantity: 2, unitCost: 30, lineTotal: 60 }),
      item({ quantity: 1, unitCost: 40, lineTotal: 40 }),
    ],
  };

  const resultado = validarConsistenciaFactura(datos);

  assert.equal(resultado.itemsConAdvertencia.size, 0);
  assert.equal(resultado.advertenciasFactura.length, 0);
  assert.equal(resultado.confidenceMaximaPorItem.size, 0);
});

test("detecta una línea individualmente inconsistente (unitCost*quantity != lineTotal)", () => {
  const datos: Pick<ExtractedInvoiceData, "items" | "invoice"> = {
    invoice: { number: null, date: null, currency: "ARS", total: null },
    items: [item({ quantity: 3, unitCost: 100, lineTotal: 200 })], // esperado 300, viene 200
  };

  const resultado = validarConsistenciaFactura(datos);

  assert.equal(resultado.itemsConAdvertencia.size, 1);
  assert.ok(resultado.itemsConAdvertencia.get(0)![0].includes("no coincide"));
  assert.equal(resultado.confidenceMaximaPorItem.get(0), CONFIDENCE_MAXIMA_SI_INCONSISTENTE);
});

test("no da falso positivo cuando falta unitCost o lineTotal", () => {
  const datos: Pick<ExtractedInvoiceData, "items" | "invoice"> = {
    invoice: { number: null, date: null, currency: "ARS", total: null },
    items: [
      item({ quantity: 2, unitCost: null, lineTotal: 60 }),
      item({ quantity: 2, unitCost: 30, lineTotal: null }),
    ],
  };

  const resultado = validarConsistenciaFactura(datos);

  assert.equal(resultado.itemsConAdvertencia.size, 0);
  assert.equal(resultado.confidenceMaximaPorItem.size, 0);
});

test("tolera diferencias chicas de redondeo (dentro del 1%)", () => {
  const datos: Pick<ExtractedInvoiceData, "items" | "invoice"> = {
    invoice: { number: null, date: null, currency: "ARS", total: null },
    items: [item({ quantity: 3, unitCost: 100.33, lineTotal: 301 })], // esperado 300.99, diff ~0.003%
  };

  const resultado = validarConsistenciaFactura(datos);

  assert.equal(resultado.itemsConAdvertencia.size, 0);
});

// Fixture basado en la factura de prueba real #46 (ver design.md, sección "Caso
// de prueba de referencia"): MANAOS COLA, BALDO BORGOÑA y COCA-COLA quedaron
// cada una internamente consistente (unitCost*quantity == lineTotal para esa
// misma línea), porque el modelo tomó los tres valores de la fila vecina — el
// chequeo por línea NO detecta esto. Solo el chequeo de cabecera (suma vs
// total) lo agarra, y por eso debe propagar el tope de confidence a todas las
// líneas, no solo a una.
test("suma de líneas vs total de factura detecta el desfasaje aunque cada línea esté 'cuadrada' internamente", () => {
  const datos: Pick<ExtractedInvoiceData, "items" | "invoice"> = {
    invoice: { number: null, date: null, currency: "ARS", total: 180700 },
    items: [
      item({ quantity: 1, unitCost: 5900, lineTotal: 5900 }),
      item({ quantity: 1, unitCost: 14500, lineTotal: 14500 }),
      item({ quantity: 1, unitCost: 8300, lineTotal: 8300 }), // MANAOS COLA: debería ser qty 3 / 24900
      item({ quantity: 1, unitCost: 11800, lineTotal: 11800 }),
      item({ quantity: 1, unitCost: 8400, lineTotal: 8400 }),
      item({ quantity: 1, unitCost: 11800, lineTotal: 11800 }),
      item({ quantity: 1, unitCost: 39000, lineTotal: 39000 }),
      item({ quantity: 1, unitCost: 25500, lineTotal: 25500 }),
      item({ quantity: 1, unitCost: 28500, lineTotal: 28500 }), // BALDO BORGOÑA: debería ser 13900
      item({ quantity: 2, unitCost: 28500, lineTotal: 57000 }), // COCA-COLA: debería ser qty 1 / 28500
    ],
  };

  const resultado = validarConsistenciaFactura(datos);

  // El chequeo #2 detecta que la suma (210700) no coincide con el total (180700),
  // y propaga tanto el tope de confidence como una advertencia visible a las 10
  // líneas — ninguna línea dispara el chequeo #1 por sí sola (todas están
  // "cuadradas" internamente), pero igual quedan marcadas por la propagación.
  assert.equal(resultado.advertenciasFactura.length, 1);
  assert.equal(resultado.confidenceMaximaPorItem.size, datos.items.length);
  assert.equal(resultado.itemsConAdvertencia.size, datos.items.length);
  for (let i = 0; i < datos.items.length; i++) {
    assert.equal(resultado.confidenceMaximaPorItem.get(i), CONFIDENCE_MAXIMA_SI_INCONSISTENTE);
    assert.equal(resultado.itemsConAdvertencia.get(i)!.length, 1);
  }
});

test("una línea que sí falla el chequeo #1 no queda duplicada por la propagación del chequeo #2", () => {
  const datos: Pick<ExtractedInvoiceData, "items" | "invoice"> = {
    invoice: { number: null, date: null, currency: "ARS", total: 50 },
    items: [
      item({ quantity: 2, unitCost: 10, lineTotal: 100 }), // inconsistente por sí sola (esperado 20, viene 100)
      item({ quantity: 1, unitCost: 10, lineTotal: 10 }),
    ],
  };

  const resultado = validarConsistenciaFactura(datos);

  // La línea 0 ya tenía su propia advertencia (chequeo #1) — la propagación del
  // chequeo #2 no debe agregarle una segunda advertencia genérica encima.
  assert.equal(resultado.itemsConAdvertencia.get(0)!.length, 1);
  assert.ok(resultado.itemsConAdvertencia.get(0)![0].includes("no coincide con el total de línea"));
  // La línea 1 sí es "nueva" para la propagación.
  assert.equal(resultado.itemsConAdvertencia.get(1)!.length, 1);
  assert.ok(resultado.itemsConAdvertencia.get(1)![0].includes("no coincide con la suma"));
});

test("factura sin total detectado no dispara el chequeo de cabecera", () => {
  const datos: Pick<ExtractedInvoiceData, "items" | "invoice"> = {
    invoice: { number: null, date: null, currency: "ARS", total: null },
    items: [item({ quantity: 1, unitCost: 100, lineTotal: 100 })],
  };

  const resultado = validarConsistenciaFactura(datos);

  assert.equal(resultado.advertenciasFactura.length, 0);
  assert.equal(resultado.confidenceMaximaPorItem.size, 0);
});
