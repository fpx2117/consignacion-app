import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";

export type CoreFixture = {
  sucursalA: number;
  sucursalB: number;
  usuarioId: number;
  clienteId: number;
  productoId: number;
  stockAId: number;
  stockBId: number;
};

const truncateSql = `
  TRUNCATE TABLE
    "MovimientoStock", "VentaDetalle", "Pago", "Venta", "LiquidacionItem",
    "Liquidacion", "ConsignacionDetalle", "Consignacion", "SesionCaja",
    "Caja", "StockSucursal", "Producto", "Cliente", "Usuario", "Sucursal"
  RESTART IDENTITY CASCADE
`;

export function requireIsolatedDatabase(): string {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TEST_DATABASE_URL es obligatoria para T10");
  }

  const url = new URL(databaseUrl);
  const isLocal = ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  const isTestDatabase = /(?:^|[_-])test$/.test(
    url.pathname.slice(1).toLowerCase(),
  );
  const databaseName = url.pathname.slice(1);
  const isExplicitlyConfirmed =
    process.env.T10_CONFIRM_DATABASE === databaseName;
  if (!isLocal || !isTestDatabase || !isExplicitlyConfirmed) {
    throw new Error(
      "T10 exige una base local terminada en test y T10_CONFIRM_DATABASE con su nombre exacto",
    );
  }

  return databaseUrl;
}

export async function connect(databaseUrl: string): Promise<Client> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

export async function resetDatabase(client: Client): Promise<void> {
  await client.query(truncateSql);
}

export async function lockHarness(client: Client): Promise<void> {
  await client.query("SELECT pg_advisory_lock(1010)");
}

export async function seedCore(
  client: Client,
  stockDisponible = 10,
  stockConsignado = 0,
): Promise<CoreFixture> {
  const sucursales = await client.query<{ id: number }>(`
    INSERT INTO "Sucursal" ("nombre", "esPrincipal", "updatedAt")
    VALUES ('T10 A', true, now()), ('T10 B', false, now())
    RETURNING "id"
  `);
  const [sucursalA, sucursalB] = sucursales.rows.map((row) => row.id);

  const usuario = await client.query<{ id: number }>(`
    INSERT INTO "Usuario" ("nombre", "email", "hash", "sucursalId", "updatedAt")
    VALUES ('T10 User', 't10@example.test', 'not-used', $1, now())
    RETURNING "id"
  `, [sucursalA]);
  const cliente = await client.query<{ id: number }>(`
    INSERT INTO "Cliente" ("nombre", "sucursalId")
    VALUES ('T10 Cliente', $1)
    RETURNING "id"
  `, [sucursalA]);
  const producto = await client.query<{ id: number }>(`
    INSERT INTO "Producto" (
      "nombre", "precioVenta", "precioCosto", "sucursalId", "updatedAt"
    ) VALUES ('T10 Producto', 100, 50, $1, now())
    RETURNING "id"
  `, [sucursalA]);

  const stocks = await client.query<{ id: number; sucursalId: number }>(`
    INSERT INTO "StockSucursal" (
      "productoId", "sucursalId", "stockDisponibleUnits", "stockConsignadoUnits"
    ) VALUES ($1, $2, $4, $5), ($1, $3, $4, $5)
    RETURNING "id", "sucursalId"
  `, [producto.rows[0].id, sucursalA, sucursalB, stockDisponible, stockConsignado]);

  const stockBySucursal = new Map(
    stocks.rows.map((row) => [row.sucursalId, row.id]),
  );
  return {
    sucursalA,
    sucursalB,
    usuarioId: usuario.rows[0].id,
    clienteId: cliente.rows[0].id,
    productoId: producto.rows[0].id,
    stockAId: stockBySucursal.get(sucursalA)!,
    stockBId: stockBySucursal.get(sucursalB)!,
  };
}

export async function backendPid(client: Client): Promise<number> {
  const result = await client.query<{ pid: number }>("SELECT pg_backend_pid() pid");
  return result.rows[0].pid;
}

export async function waitForLock(
  observer: Client,
  blockedPid: number,
): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = await observer.query<{ waiting: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE pid = $1 AND wait_event_type = 'Lock'
      ) waiting
    `, [blockedPid]);
    if (result.rows[0].waiting) return;
    await delay(25);
  }
  assert.fail(`El backend ${blockedPid} no quedó esperando un lock`);
}

export async function rollbackQuietly(client: Client): Promise<void> {
  await client.query("ROLLBACK").catch(() => undefined);
}
