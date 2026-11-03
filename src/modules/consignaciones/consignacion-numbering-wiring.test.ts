import assert from "node:assert/strict";
import test from "node:test";

import type { ConsignacionesPostDeps } from "../../app/api/consignaciones/route";

test("the handler uses the persisted folio for effects and response", async () => {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@127.0.0.1:55432/t12_numbering_test";
  process.env.JWT_SECRET ??= "t12-test-secret-at-least-32-characters-long";
  const { handlePostConsignacion } = await import(
    "../../app/api/consignaciones/route"
  );
  let createData: Record<string, unknown> | undefined;
  let movementData: Record<string, unknown> | undefined;
  const transaction = {
    $queryRaw: async () => [{ modo: "APP_DUAL_WRITE", projection: 0 }],
    cliente: { findUnique: async () => ({ id: 1 }) },
    consignacion: {
      findFirst: async () => ({ numeroFolio: 3 }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createData = data;
        return { id: 99, numeroFolio: 9 };
      },
      findUnique: async () => ({ id: 99, numeroFolio: 9 }),
    },
    stockSucursal: {
      findMany: async () => [
        {
          id: 10,
          productoId: 20,
          stockDisponibleUnits: 5,
          producto: { precioVenta: 100 },
        },
      ],
      update: async () => ({ stockDisponibleUnits: 4 }),
    },
    producto: { update: async () => ({}) },
    movimientoStock: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        movementData = data;
        return {};
      },
    },
  };
  const deps = {
    requireAuth: async () => ({
      ok: true,
      user: { sub: "1", role: "ADMIN" },
      activeSucursalId: 1,
      allowedSucursalIds: [1],
    }),
    isGlobalSucursalView: () => false,
    checkFeature: async () => ({ allowed: true }),
    obtenerConfiguracionGlobal: async () => ({
      porcentajeAumentoConsignacion: 0,
    }),
    evaluateStockAlert: () => null,
    processNotificationQueue: async () => undefined,
    prisma: {
      $transaction: async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
    },
  } as unknown as ConsignacionesPostDeps;
  const request = new Request("http://localhost/api/consignaciones", {
    method: "POST",
    body: JSON.stringify({
      clienteId: 1,
      items: [{ productoId: 20, unitsEntregadas: 1 }],
    }),
  });

  const response = await handlePostConsignacion(request, deps);
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(createData?.numeroFolio, 4);
  assert.equal(
    movementData?.observaciones,
    "Entrega de ConsignaciÃ³n Folio #9",
  );
  assert.equal(body.data.numeroFolio, 9);
});
