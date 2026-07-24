import assert from "node:assert/strict";
import test from "node:test";
import { handlePostVenta } from "@/app/api/ventas/route";

type VentaDeps = NonNullable<Parameters<typeof handlePostVenta>[1]>;
type VentaAuth = Awaited<ReturnType<VentaDeps["requireAuth"]>>;

const okAuth: VentaAuth = {
  ok: true as const,
  user: {
    sub: "7",
    rol: "ADMIN" as const,
    email: "admin@example.com",
    nombre: "Admin",
    sucursalId: 3,
  },
  activeSucursalId: 3,
  allowedSucursalIds: [3],
  isGlobalView: false,
  token: "token",
};

test("handlePostVenta usa la timezone resuelta para fechar venta y pago", async () => {
  const nowCalls: string[] = [];
  const createdVentas: Array<{ fecha: Date }> = [];
  const createdPagos: Array<{ fecha: Date }> = [];

  const response = await handlePostVenta(
    new Request("http://localhost/api/ventas", {
      method: "POST",
      body: JSON.stringify({
        items: [{ productoId: 11, units: 2 }],
        descuentoGlobal: 0,
        metodoPago: "EFECTIVO",
      }),
      headers: { "Content-Type": "application/json" },
    }),
    {
      requireAuth: async () => okAuth,
      isGlobalSucursalView: () => false,
      obtenerConfiguracionGlobal: async () => ({
        usarControlDeCaja: true,
        notificarVentas: false,
        porcentajeInteresTarjeta: 0,
      }),
      resolveTimezoneForAuth: async () => ({
        tz: "America/Bogota",
        source: "user",
        userId: 7,
        sucursalId: 3,
        zonaHorariaUsuario: "America/Bogota",
        zonaHorariaSucursal: "America/Santiago",
      }),
      nowAR: (tz: string) => {
        nowCalls.push(tz);
        return new Date(`2026-02-01T0${nowCalls.length}:00:00.000Z`);
      },
      prisma: {
        sesionCaja: {
          findFirst: async () => ({ id: 15 }),
        },
        cliente: {
          findFirst: async () => ({ id: 22 }),
          create: async () => ({ id: 22 }),
        },
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            stockSucursal: {
              findUnique: async () => ({
                producto: { nombre: "Mate", precioVenta: 1250 },
                precioVentaOverride: null,
                stockDisponibleUnits: 8,
              }),
              updateMany: async () => ({ count: 1 }),
            },
            producto: {
              updateMany: async () => ({ count: 1 }),
              findUnique: async () => ({
                id: 11,
                nombre: "Mate",
                stockDisponibleUnits: 6,
              }),
            },
            movimientoStock: {
              create: async () => undefined,
            },
            $executeRaw: async () => undefined,
            venta: {
              findFirst: async () => ({ numeroVenta: 40 }),
              create: async ({ data }: { data: { fecha: Date } }) => {
                createdVentas.push({ fecha: data.fecha });
                return {
                  id: 501,
                  clienteId: 22,
                  total: 2500,
                  fecha: data.fecha,
                  cliente: { nombre: "Consumidor Final" },
                  detalles: [],
                };
              },
            },
            pago: {
              create: async ({ data }: { data: { fecha: Date } }) => {
                createdPagos.push({ fecha: data.fecha });
                return { id: 601, fecha: data.fecha };
              },
            },
          }),
        notification: {
          create: async () => null,
        },
      },
      evaluateStockAlert: () => null,
      processNotificationQueue: async () => undefined,
      sendNotification: async () => undefined,
    } as unknown as VentaDeps,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(nowCalls, ["America/Bogota", "America/Bogota"]);
  assert.deepEqual(
    createdVentas.map((item) => item.fecha.toISOString()),
    ["2026-02-01T01:00:00.000Z"],
  );
  assert.deepEqual(
    createdPagos.map((item) => item.fecha.toISOString()),
    ["2026-02-01T02:00:00.000Z"],
  );
});
