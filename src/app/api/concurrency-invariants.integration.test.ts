import assert from "node:assert/strict";
import test from "node:test";
import {
  backendPid,
  connect,
  lockHarness,
  requireIsolatedDatabase,
  resetDatabase,
  rollbackQuietly,
  seedCore,
  waitForLock,
} from "@/app/api/concurrency-baseline.integration-fixture";

// T10-R: los archivos originales de T10 reproducian los defectos ANTES de las
// correcciones. Con T12 (folios), T13-B (anulacion) y T14/T15 (stock) aplicados
// esas intercalaciones ya no pueden completarse: la segunda insercion espera al
// indice unico y el test colgaba. Aca se afirma el invariante post-correccion.
//
// Los escenarios ya corregidos se afirman como invariante post-correccion. No
// quedan caracterizaciones pendientes en este archivo.

const databaseUrl = requireIsolatedDatabase();

async function reset(fixtureClient: Awaited<ReturnType<typeof connect>>) {
  await resetDatabase(fixtureClient);
  // Los numeradores no estan en el truncado compartido: sin esto los folios
  // siguen contando entre tests y las aserciones absolutas dejan de valer.
  await fixtureClient.query(
    `TRUNCATE TABLE "VentaNumerador", "ConsignacionNumerador" RESTART IDENTITY CASCADE`,
  );
}

test("la asignacion de folios concurrente no colisiona", async () => {
  const observer = await connect(databaseUrl);
  const first = await connect(databaseUrl);
  const second = await connect(databaseUrl);
  try {
    await lockHarness(observer);
    await reset(observer);
    const fixture = await seedCore(observer);
    const secondPid = await backendPid(second);

    await first.query("BEGIN");
    const firstInsert = await first.query<{ numeroVenta: number }>(
      `INSERT INTO "Venta" ("clienteId", "sucursalId", total, tipo)
       VALUES ($1, $2, 10, 'CASUAL') RETURNING "numeroVenta"`,
      [fixture.clienteId, fixture.sucursalA],
    );

    await second.query("BEGIN");
    const blocked = second.query<{ numeroVenta: number }>(
      `INSERT INTO "Venta" ("clienteId", "sucursalId", total, tipo)
       VALUES ($1, $2, 20, 'CASUAL') RETURNING "numeroVenta"`,
      [fixture.clienteId, fixture.sucursalA],
    );
    await waitForLock(observer, secondPid);
    await first.query("COMMIT");
    const secondInsert = (await blocked).rows[0];
    await second.query("COMMIT");

    const numbers = [firstInsert.rows[0].numeroVenta, secondInsert.numeroVenta];
    assert.equal(new Set(numbers).size, 2, `folios repetidos: ${numbers}`);
    assert.deepEqual(numbers, [1, 2]);
  } finally {
    await rollbackQuietly(first);
    await rollbackQuietly(second);
    await Promise.all([observer.end(), first.end(), second.end()]);
  }
});

test("la autoridad asigna el numero de venta e ignora el valor del cliente", async () => {
  const observer = await connect(databaseUrl);
  try {
    await lockHarness(observer);
    await reset(observer);
    const fixture = await seedCore(observer);

    // El trigger BEFORE INSERT siempre asigna: mandar 99 no fija el folio.
    const venta = await observer.query<{ id: number; numeroVenta: number }>(
      `INSERT INTO "Venta" ("clienteId", "sucursalId", "numeroVenta", total, tipo)
       VALUES ($1, $2, 99, 10, 'CASUAL') RETURNING id, "numeroVenta"`,
      [fixture.clienteId, fixture.sucursalA],
    );
    assert.equal(venta.rows[0].numeroVenta, 1);

    // Y una vez asignado, el numero es inmutable.
    await assert.rejects(
      observer.query(`UPDATE "Venta" SET "numeroVenta" = 5 WHERE id = $1`, [
        venta.rows[0].id,
      ]),
      (error: { message?: string }) => {
        assert.match(error.message ?? "", /immutable/);
        return true;
      },
    );
  } finally {
    await observer.end();
  }
});

test("la autoridad asigna el folio de consignacion e ignora el valor del cliente", async () => {
  const observer = await connect(databaseUrl);
  try {
    await lockHarness(observer);
    await reset(observer);
    const fixture = await seedCore(observer);

    const consignacion = await observer.query<{
      id: number;
      numeroFolio: number;
    }>(
      `INSERT INTO "Consignacion" ("clienteId", "sucursalId", "numeroFolio")
       VALUES ($1, $2, 99) RETURNING id, "numeroFolio"`,
      [fixture.clienteId, fixture.sucursalA],
    );
    assert.equal(consignacion.rows[0].numeroFolio, 1);

    await assert.rejects(
      observer.query(
        `UPDATE "Consignacion" SET "numeroFolio" = 5 WHERE id = $1`,
        [consignacion.rows[0].id],
      ),
      (error: { message?: string }) => {
        assert.match(error.message ?? "", /immutable/);
        return true;
      },
    );
  } finally {
    await observer.end();
  }
});

test("una venta se anula una sola vez bajo concurrencia", async () => {
  const observer = await connect(databaseUrl);
  const first = await connect(databaseUrl);
  const second = await connect(databaseUrl);
  try {
    await lockHarness(observer);
    await reset(observer);
    const fixture = await seedCore(observer);
    const venta = await observer.query<{ id: number }>(
      `INSERT INTO "Venta" ("clienteId", "sucursalId", total, tipo)
       VALUES ($1, $2, 30, 'CASUAL') RETURNING id`,
      [fixture.clienteId, fixture.sucursalA],
    );
    const secondPid = await backendPid(second);

    await Promise.all([first.query("BEGIN"), second.query("BEGIN")]);
    const claimFirst = await first.query(
      `UPDATE "Venta" SET anulada = true
       WHERE id = $1 AND anulada = false`,
      [venta.rows[0].id],
    );
    assert.equal(claimFirst.rowCount, 1);

    const blocked = second.query(
      `UPDATE "Venta" SET anulada = true
       WHERE id = $1 AND anulada = false`,
      [venta.rows[0].id],
    );
    await waitForLock(observer, secondPid);
    await first.query("COMMIT");
    const claimSecond = await blocked;
    await second.query("COMMIT");

    assert.equal(claimSecond.rowCount, 0, "el perdedor no debe reclamar la venta");
    const state = await observer.query<{ anulada: boolean }>(
      `SELECT anulada FROM "Venta" WHERE id = $1`,
      [venta.rows[0].id],
    );
    assert.equal(state.rows[0].anulada, true);
  } finally {
    await rollbackQuietly(first);
    await rollbackQuietly(second);
    await Promise.all([observer.end(), first.end(), second.end()]);
  }
});

test("la venta espera al cierre y no queda ligada a una caja cerrada", async () => {
  const observer = await connect(databaseUrl);
  const pos = await connect(databaseUrl);
  const close = await connect(databaseUrl);
  try {
    await lockHarness(observer);
    await reset(observer);
    const fixture = await seedCore(observer);
    const caja = await observer.query<{ id: number }>(
      `INSERT INTO "Caja" (nombre, "sucursalId") VALUES ('T20 Caja', $1) RETURNING id`,
      [fixture.sucursalA],
    );
    const session = await observer.query<{ id: number }>(
      `INSERT INTO "SesionCaja" ("cajaId", "usuarioId", "montoInicial")
       VALUES ($1, $2, 100) RETURNING id`,
      [caja.rows[0].id, fixture.usuarioId],
    );
    const posPid = await backendPid(pos);

    // El cierre reclama la sesión.
    await close.query("BEGIN");
    await close.query(
      `SELECT "estado" FROM "SesionCaja" WHERE "id" = $1 FOR UPDATE`,
      [session.rows[0].id],
    );

    // La venta bloquea la sesión con la misma consulta del adaptador (T20/T22):
    // usuario + sucursal de la caja, con FOR SHARE.
    await pos.query("BEGIN");
    const claim = pos.query<{ id: number }>(
      `SELECT s."id" FROM "SesionCaja" s
       JOIN "Caja" c ON c."id" = s."cajaId"
       WHERE s."usuarioId" = $1 AND s."estado" = 'ABIERTA' AND c."sucursalId" = $2
       LIMIT 1 FOR SHARE OF s`,
      [fixture.usuarioId, fixture.sucursalA],
    );
    await waitForLock(observer, posPid);

    await close.query(
      `UPDATE "SesionCaja"
       SET "estado" = 'CERRADA', "fechaCierre" = now()
       WHERE "id" = $1`,
      [session.rows[0].id],
    );
    await close.query("COMMIT");

    const claimed = (await claim).rows;
    await pos.query("COMMIT");

    // El cierre ganó: la fila ya no cumple el predicado y la venta no se asocia.
    assert.equal(claimed.length, 0);
    const ventas = await observer.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM "Venta" WHERE "sesionCajaId" = $1`,
      [session.rows[0].id],
    );
    assert.equal(ventas.rows[0].count, 0);
  } finally {
    await Promise.all([observer.end(), pos.end(), close.end()]);
  }
});

test("el cierre de caja espera la venta en vuelo y se reclama una sola vez", async () => {
  const observer = await connect(databaseUrl);
  const sale = await connect(databaseUrl);
  const close = await connect(databaseUrl);
  try {
    await lockHarness(observer);
    await reset(observer);
    const fixture = await seedCore(observer);
    const caja = await observer.query<{ id: number }>(
      `INSERT INTO "Caja" (nombre, "sucursalId") VALUES ('T22 Caja', $1) RETURNING id`,
      [fixture.sucursalA],
    );
    const session = await observer.query<{ id: number }>(
      `INSERT INTO "SesionCaja" ("cajaId", "usuarioId", "montoInicial")
       VALUES ($1, $2, 100) RETURNING id`,
      [caja.rows[0].id, fixture.usuarioId],
    );
    const sessionId = session.rows[0].id;
    const closePid = await backendPid(close);

    // Venta en vuelo: reclama la sesión (FOR SHARE, como T20).
    await sale.query("BEGIN");
    await sale.query(
      `SELECT "id" FROM "SesionCaja"
       WHERE "id" = $1 AND "estado" = 'ABIERTA' FOR SHARE`,
      [sessionId],
    );

    // El cierre pide el lock exclusivo: espera a que la venta termine.
    await close.query("BEGIN");
    const lock = close.query<{ id: number }>(
      `SELECT "id" FROM "SesionCaja" WHERE "id" = $1 FOR UPDATE`,
      [sessionId],
    );
    await waitForLock(observer, closePid);

    await sale.query(
      `INSERT INTO "Venta" ("clienteId", "sucursalId", "sesionCajaId", total, tipo)
       VALUES ($1, $2, $3, 50, 'CASUAL')`,
      [fixture.clienteId, fixture.sucursalA, sessionId],
    );
    await sale.query("COMMIT");

    // Al retomar, el cierre ve la venta confirmada y la incluye.
    await lock;
    const total = await close.query<{ total: string }>(
      `SELECT COALESCE(SUM(total), 0)::text AS total
       FROM "Venta" WHERE "sesionCajaId" = $1 AND tipo = 'CASUAL'`,
      [sessionId],
    );
    assert.equal(total.rows[0].total, "50.00");

    const first = await close.query(
      `UPDATE "SesionCaja" SET "estado" = 'CERRADA'
       WHERE "id" = $1 AND "estado" = 'ABIERTA'`,
      [sessionId],
    );
    await close.query("COMMIT");
    assert.equal(first.rowCount, 1);

    // Un segundo cierre ya no reclama nada y no pisa el total.
    const second = await observer.query(
      `UPDATE "SesionCaja" SET "estado" = 'CERRADA'
       WHERE "id" = $1 AND "estado" = 'ABIERTA'`,
      [sessionId],
    );
    assert.equal(second.rowCount, 0);
  } finally {
    await rollbackQuietly(sale);
    await rollbackQuietly(close);
    await Promise.all([observer.end(), sale.end(), close.end()]);
  }
});

test("dos liquidaciones concurrentes no exceden las unidades pendientes", async () => {
  const observer = await connect(databaseUrl);
  const first = await connect(databaseUrl);
  const second = await connect(databaseUrl);
  try {
    await lockHarness(observer);
    await reset(observer);
    const fixture = await seedCore(observer, 0);
    await observer.query(
      `UPDATE "StockSucursal" SET "stockConsignadoUnits" = 5 WHERE id = $1`,
      [fixture.stockAId],
    );
    const consignacion = await observer.query<{ id: number }>(
      `INSERT INTO "Consignacion" ("clienteId", "sucursalId", "numeroFolio")
       VALUES ($1, $2, 1) RETURNING id`,
      [fixture.clienteId, fixture.sucursalA],
    );
    const detalle = await observer.query<{ id: number }>(
      `INSERT INTO "ConsignacionDetalle" (
         "consignacionId", "productoId", "unitsEntregadas", "precioUnitario"
       ) VALUES ($1, $2, 5, 100) RETURNING id`,
      [consignacion.rows[0].id, fixture.productoId],
    );
    const detalleId = detalle.rows[0].id;
    const secondPid = await backendPid(second);

    // La misma condición que aplica `claimSettlementUnits`.
    const claim = `UPDATE "ConsignacionDetalle"
      SET "unitsVendidasAcum" = "unitsVendidasAcum" + 4
      WHERE "id" = $1
        AND ("unitsEntregadas" - "unitsVendidasAcum" - "unitsDevueltasAcum") >= 4
      RETURNING "id"`;

    await Promise.all([first.query("BEGIN"), second.query("BEGIN")]);
    const firstClaim = await first.query<{ id: number }>(claim, [detalleId]);
    const blocked = second.query<{ id: number }>(claim, [detalleId]);
    await waitForLock(observer, secondPid);
    await first.query("COMMIT");

    const secondClaim = await blocked;
    await second.query("COMMIT");

    // El segundo escritor espera el lock de fila y re-evalúa contra la versión
    // confirmada: ya no quedan pendientes suficientes.
    assert.equal(firstClaim.rowCount, 1);
    assert.equal(secondClaim.rowCount, 0);

    const final = await observer.query<{
      unitsEntregadas: number;
      unitsVendidasAcum: number;
      unitsDevueltasAcum: number;
    }>(
      `SELECT "unitsEntregadas", "unitsVendidasAcum", "unitsDevueltasAcum"
       FROM "ConsignacionDetalle" WHERE "id" = $1`,
      [detalleId],
    );
    assert.equal(final.rows[0].unitsVendidasAcum, 4);
    assert.ok(
      final.rows[0].unitsVendidasAcum + final.rows[0].unitsDevueltasAcum <=
        final.rows[0].unitsEntregadas,
    );
  } finally {
    await rollbackQuietly(first);
    await rollbackQuietly(second);
    await Promise.all([observer.end(), first.end(), second.end()]);
  }
});
