import assert from "node:assert/strict";
import test from "node:test";
import {
  getAtributosFijos,
  RUBRO_ATRIBUTOS_FIJOS,
} from "@/modules/invoices/config/rubro-atributos";

test("devuelve los atributos fijos definidos para un rubro cubierto", () => {
  const atributos = getAtributosFijos("perfumeria");
  assert.ok(atributos.length > 0);
  assert.ok(atributos.some((a) => a.clave === "ml" && a.tipo === "numero"));
});

test("vapes tiene marca requerida, sabor opcional (hay dispositivos sin sabor)", () => {
  const atributos = getAtributosFijos("vapes");
  assert.ok(atributos.length > 0);
  assert.ok(atributos.some((a) => a.clave === "marca" && a.requerido));
  assert.ok(atributos.some((a) => a.clave === "sabor" && !a.requerido));
});

test("devuelve [] para un rubro sin catálogo fijo definido", () => {
  assert.deepEqual(getAtributosFijos("kiosco"), []);
});

test("devuelve [] para rubro null, undefined o vacío", () => {
  assert.deepEqual(getAtributosFijos(null), []);
  assert.deepEqual(getAtributosFijos(undefined), []);
  assert.deepEqual(getAtributosFijos(""), []);
});

test("devuelve [] para el slug de texto libre 'otro'", () => {
  assert.deepEqual(getAtributosFijos("otro"), []);
});

test("todas las claves de atributos fijos son únicas dentro de cada rubro", () => {
  for (const [rubro, atributos] of Object.entries(RUBRO_ATRIBUTOS_FIJOS)) {
    const claves = atributos.map((a) => a.clave);
    assert.equal(
      new Set(claves).size,
      claves.length,
      `claves duplicadas en el rubro "${rubro}"`,
    );
  }
});

test("las opciones de selección están presentes cuando tipo es 'seleccion'", () => {
  for (const atributos of Object.values(RUBRO_ATRIBUTOS_FIJOS)) {
    for (const atributo of atributos) {
      if (atributo.tipo === "seleccion") {
        assert.ok(
          Array.isArray(atributo.opciones) && atributo.opciones.length > 0,
          `atributo "${atributo.clave}" es tipo seleccion sin opciones`,
        );
      }
    }
  }
});
