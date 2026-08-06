import assert from "node:assert/strict";
import test from "node:test";
import {
  componerNombreProducto,
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

test("componerNombreProducto: marca + sabor + puffs (vapes)", () => {
  const def = getAtributosFijos("vapes");
  const nombre = componerNombreProducto(def, {
    marca: "ELFBAR ICE KING",
    sabor: "Black Mint",
    puffs: "40000",
  });
  assert.equal(nombre, "ELFBAR ICE KING - Black Mint - 40000 Puffs");
});

test("componerNombreProducto: marca sin sabor ni puffs (dispositivo)", () => {
  const def = getAtributosFijos("vapes");
  const nombre = componerNombreProducto(def, { marca: "Vaporesso" });
  assert.equal(nombre, "Vaporesso");
});

test("componerNombreProducto: null si falta la marca", () => {
  const def = getAtributosFijos("vapes");
  assert.equal(componerNombreProducto(def, { sabor: "Mango" }), null);
  assert.equal(componerNombreProducto(def, null), null);
});

test("componerNombreProducto: null para rubros sin forma marca+sabor (ej. ferretería)", () => {
  const def = getAtributosFijos("ferreteria");
  assert.equal(
    componerNombreProducto(def, { marca: "Bosch", medida: "10mm" }),
    null,
  );
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
