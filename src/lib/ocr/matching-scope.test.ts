// Aislamiento por sucursal del contexto de matching de OCR.
//
// `construirContextoMatching` alimenta la propuesta de producto por línea de
// factura. Si los alias de proveedor pudieran apuntar a productos de otra
// sucursal, el matcher propondría un producto inválido. El guard de confirmación
// ya lo rechaza aguas abajo, pero el filtro tiene que estar en el origen: así el
// vector no depende de que ese guard siga existiendo.

import assert from "node:assert/strict";
import test from "node:test";

import {
  construirContextoMatching,
  type MatchingDeps,
} from "./matching-engine";

function makeDeps(captured: Array<Record<string, unknown>>) {
  const deps = {
    prisma: {
      producto: {
        findMany: async () => [],
      },
      productoProveedorAlias: {
        findMany: async (args: Record<string, unknown>) => {
          captured.push(args);
          return [];
        },
      },
    },
  } as unknown as MatchingDeps;
  return deps;
}

test("el catálogo se consulta acotado a la sucursal pedida", async () => {
  const productoCalls: Array<Record<string, unknown>> = [];
  const deps = {
    prisma: {
      producto: {
        findMany: async (args: Record<string, unknown>) => {
          productoCalls.push(args);
          return [];
        },
      },
      productoProveedorAlias: {
        findMany: async () => [],
      },
    },
  } as unknown as MatchingDeps;

  await construirContextoMatching({ sucursalId: 7, proveedorId: null }, deps);

  assert.deepEqual(productoCalls, [
    {
      where: { sucursalId: 7, activo: true },
      select: { id: true, nombre: true },
    },
  ]);
});

test("los alias de proveedor se filtran por la sucursal del producto", async () => {
  const captured: Array<Record<string, unknown>> = [];

  await construirContextoMatching(
    { sucursalId: 7, proveedorId: 3 },
    makeDeps(captured),
  );

  assert.equal(captured.length, 1);
  assert.deepEqual(captured[0], {
    where: {
      proveedorId: 3,
      producto: { sucursalId: 7 },
    },
  });
});

test("sin proveedor no se consultan alias", async () => {
  const captured: Array<Record<string, unknown>> = [];

  await construirContextoMatching(
    { sucursalId: 7, proveedorId: null },
    makeDeps(captured),
  );

  assert.equal(captured.length, 0);
});
