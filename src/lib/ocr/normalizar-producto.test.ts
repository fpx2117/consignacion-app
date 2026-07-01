import assert from "node:assert/strict";
import test from "node:test";
import { normalizarProducto, normalizarTexto } from "@/lib/ocr/normalizar-producto";

test("normalizarTexto colapsa mayúsculas, acentos y símbolos", () => {
  assert.equal(normalizarTexto("Perfúme Único! (Nuevo)"), "perfume unico nuevo");
});

test("normalizarTexto unifica variantes de unidades", () => {
  assert.equal(normalizarTexto("Mayar 100 ML"), "mayar 100ml");
  assert.equal(normalizarTexto("Mayar 100ml"), "mayar 100ml");
  assert.equal(normalizarTexto("Mayar 100  Ml"), "mayar 100ml");
});

test("normalizarProducto no altera el texto directo, sólo la variante corregida", () => {
  const resultado = normalizarProducto("MT LATTARA MAYAR (PIM) EDP");
  assert.equal(resultado.normalizado, "mt lattara mayar pim edp");
  assert.equal(resultado.normalizadoCorregido, "mt lattafa mayar pink edp");
});

test("normalizarProducto es estable cuando no hay correcciones que aplicar", () => {
  const resultado = normalizarProducto("Producto Sin Errores 50ml");
  assert.equal(resultado.normalizado, resultado.normalizadoCorregido);
});
