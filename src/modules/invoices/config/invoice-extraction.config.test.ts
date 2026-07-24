import assert from "node:assert/strict";
import test from "node:test";
import { validateExtractedInvoice } from "@/modules/invoices/config/invoice-extraction.config";

function jsonValido(overrides: Record<string, unknown> = {}) {
  return {
    supplier: { name: "Proveedor SA", taxId: "20-12345678-9" },
    invoice: {
      number: "0001-00001234",
      date: "2026-07-02",
      currency: "ARS",
      total: 1000,
    },
    items: [
      {
        rawDescription: "Producto A",
        supplierCode: "160",
        quantity: 1,
        unitCost: 1000,
        lineTotal: 1000,
        confidence: 0.9,
        extraAttributes: [],
      },
    ],
    warnings: [],
    ...overrides,
  };
}

test("acepta un JSON con la forma esperada", () => {
  const resultado = validateExtractedInvoice(jsonValido());
  assert.equal(resultado.valid, true);
  assert.deepEqual(resultado.errors, []);
});

test("rechaza un valor que no es un objeto", () => {
  const resultado = validateExtractedInvoice("no es un objeto");
  assert.equal(resultado.valid, false);
  assert.ok(resultado.errors.length > 0);
});

test("rechaza cuando falta 'supplier'", () => {
  const data = jsonValido();
  // @ts-expect-error - se remueve a propósito para probar el caso inválido
  delete data.supplier;
  const resultado = validateExtractedInvoice(data);
  assert.equal(resultado.valid, false);
});

test("rechaza cuando 'invoice.total' tiene el tipo incorrecto", () => {
  const data = jsonValido({
    invoice: { number: null, date: null, currency: "ARS", total: "1000" },
  });
  const resultado = validateExtractedInvoice(data);
  assert.equal(resultado.valid, false);
});

test("rechaza cuando 'items' no es un array", () => {
  const data = jsonValido({ items: "no es un array" });
  const resultado = validateExtractedInvoice(data);
  assert.equal(resultado.valid, false);
});

test("rechaza cuando un item tiene 'confidence' fuera de rango [0,1]", () => {
  const data = jsonValido();
  data.items[0].confidence = 1.5;
  const resultado = validateExtractedInvoice(data);
  assert.equal(resultado.valid, false);
});

test("rechaza cuando falta 'warnings'", () => {
  const data = jsonValido();
  // @ts-expect-error - se remueve a propósito para probar el caso inválido
  delete data.warnings;
  const resultado = validateExtractedInvoice(data);
  assert.equal(resultado.valid, false);
});

// Confirma el límite documentado en invoice-extraction.config.ts: este schema
// valida FORMA y TIPOS, no CONTENIDO. Un JSON con montos incorrectos pero bien
// tipados (el caso real observado: unitCost=28500 en una línea donde el papel
// decía 13900) pasa esta validación sin ningún error — la detección de ese tipo
// de problema es responsabilidad exclusiva de validarConsistenciaFactura(), no
// de este schema. Ver openspec/changes/mejora-precision-lineas-factura-ocr/.
test("NO detecta montos incorrectos bien tipados (responsabilidad de validarConsistenciaFactura, no de este schema)", () => {
  const data = jsonValido({
    invoice: {
      number: null,
      date: "2026-07-02",
      currency: "ARS",
      total: 180700,
    },
    items: [
      {
        rawDescription: "BALDO BORGOÑA 6X2",
        supplierCode: "526",
        quantity: 1,
        unitCost: 28500, // el papel real dice 13900 — sigue siendo un number válido
        lineTotal: 28500,
        confidence: 1, // el modelo "seguro" de un dato incorrecto — también válido para este schema
        extraAttributes: [],
      },
    ],
  });

  const resultado = validateExtractedInvoice(data);
  assert.equal(resultado.valid, true);
});
