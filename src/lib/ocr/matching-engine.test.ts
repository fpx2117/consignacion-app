import assert from "node:assert/strict";
import test from "node:test";
import { EstadoItemFactura } from "@prisma/client";
import { matchearItem, type ContextoMatching } from "@/lib/ocr/matching-engine";

function contexto(overrides: Partial<ContextoMatching> = {}): ContextoMatching {
  return {
    productos: [],
    productosPorNombreNormalizado: new Map(),
    aliasPorCodigo: new Map(),
    aliasPorTexto: new Map(),
    ...overrides,
  };
}

test("capa 1: alias por código de proveedor exacto gana sobre cualquier otra señal", () => {
  const ctx = contexto({
    productos: [{ id: 99, nombre: "Producto que no debería matchear por nombre" }],
    aliasPorCodigo: new Map([["1234-5", 152]]),
  });

  const resultado = matchearItem({ textoOriginal: "cualquier cosa", codigoProveedor: "1234-5" }, ctx);

  assert.equal(resultado.productoId, 152);
  assert.equal(resultado.motivo, "codigo_proveedor");
  assert.equal(resultado.estado, EstadoItemFactura.COINCIDENCIA_SEGURA);
  assert.equal(resultado.score, 1);
});

test("capa 2: alias por texto normalizado exacto", () => {
  const ctx = contexto({
    aliasPorTexto: new Map([["mt lattara mayar pim edp", 152]]),
  });

  const resultado = matchearItem({ textoOriginal: "MT LATTARA MAYAR (PIM) EDP", codigoProveedor: null }, ctx);

  assert.equal(resultado.productoId, 152);
  assert.equal(resultado.motivo, "alias");
  assert.equal(resultado.estado, EstadoItemFactura.COINCIDENCIA_SEGURA);
});

test("capa 3: nombre exacto normalizado contra el catálogo", () => {
  const ctx = contexto({
    productosPorNombreNormalizado: new Map([["mayar pink edp 100ml", 7]]),
  });

  const resultado = matchearItem({ textoOriginal: "Mayar Pink EDP 100ML", codigoProveedor: null }, ctx);

  assert.equal(resultado.productoId, 7);
  assert.equal(resultado.motivo, "nombre_exacto");
  assert.equal(resultado.estado, EstadoItemFactura.COINCIDENCIA_SEGURA);
});

test("capa 4: fuzzy clasifica como REQUIERE_REVISION un parecido moderado (caso Lattafa Mayar del enunciado)", () => {
  const ctx = contexto({
    productos: [{ id: 7, nombre: "LATTAFA - MAYAR PINK EDP 100ML" }],
  });

  const resultado = matchearItem({ textoOriginal: "MT LATTAFA MAYAR (PIM) EDP", codigoProveedor: null }, ctx);

  assert.equal(resultado.productoId, 7);
  assert.equal(resultado.motivo, "fuzzy");
  assert.ok(resultado.score !== null && resultado.score > 0.5, "el score debería reflejar un parecido real");
});

test("fuzzy: sin ningún producto parecido, no asocia y marca SIN_COINCIDENCIA", () => {
  const ctx = contexto({
    productos: [{ id: 1, nombre: "Algo completamente distinto zzz" }],
  });

  const resultado = matchearItem({ textoOriginal: "Otro producto sin relación qqq", codigoProveedor: null }, ctx);

  assert.equal(resultado.estado, EstadoItemFactura.SIN_COINCIDENCIA);
});

test("ambigüedad: dos productos casi idénticos fuerzan revisión aunque el score crudo sea alto", () => {
  const ctx = contexto({
    productos: [
      { id: 1, nombre: "Lattafa Mayar Pink EDP 100ml" },
      { id: 2, nombre: "Lattafa Mayar Pink EDP 50ml" },
    ],
  });

  const resultado = matchearItem({ textoOriginal: "Lattafa Mayar Pink EDP", codigoProveedor: null }, ctx);

  assert.equal(resultado.motivo, "fuzzy");
  assert.equal(resultado.estado, EstadoItemFactura.REQUIERE_REVISION);
});

test("catálogo vacío no rompe y devuelve SIN_COINCIDENCIA", () => {
  const resultado = matchearItem({ textoOriginal: "Cualquier producto", codigoProveedor: null }, contexto());
  assert.equal(resultado.productoId, null);
  assert.equal(resultado.estado, EstadoItemFactura.SIN_COINCIDENCIA);
});
