// Smoke HTTP autenticado de los writers B1 (T15-R).
//
// Recorre login real, POS efectivo y tarjeta, anulación, consignación y
// liquidación, pedido esperado y confirmación de ítem de factura (OCR), y al
// final compara la proyección de `Producto` contra `SUM(StockSucursal)` en todos
// los productos.
//
// Pensado para el fixture de `scripts/smoke/seed-t15r-fixture.mjs` sobre una base
// descartable. Contra un entorno remoto exige `SMOKE_ALLOW_REMOTE=true` explícito
// porque escribe registros reales.
//
// Uso:
//   SMOKE_BASE_URL=http://localhost:3100 \
//   SMOKE_EMAIL=... SMOKE_PASSWORD=... \
//   SMOKE_DATABASE_URL=postgresql://.../t15r_smoke \
//   node scripts/smoke/t15r-http.mjs

import assert from "node:assert/strict";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3100";
const EMAIL = process.env.SMOKE_EMAIL;
const PASSWORD = process.env.SMOKE_PASSWORD;
const DB_URL = process.env.SMOKE_DATABASE_URL ?? null;
const FACTURA_ITEM_ID = Number(process.env.SMOKE_FACTURA_ITEM_ID ?? 1);

const local = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/.test(BASE);
if (!local && process.env.SMOKE_ALLOW_REMOTE !== "true") {
  throw new Error(
    "El smoke escribe registros reales. Para apuntarlo fuera de localhost definí SMOKE_ALLOW_REMOTE=true.",
  );
}
if (!EMAIL || !PASSWORD) {
  throw new Error("SMOKE_EMAIL y SMOKE_PASSWORD son obligatorios");
}

const cookies = new Map();
const report = { steps: [], drift: null };

async function call(method, path, body) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookies.size > 0) {
    headers.cookie = [...cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });

  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const separator = pair.indexOf("=");
    if (separator > 0) {
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: response.status, json };
}

function step(name, detail) {
  report.steps.push({ name, ...detail });
  console.log(`OK ${name}`, JSON.stringify(detail));
}

async function product(name) {
  const { status, json } = await call("GET", "/api/productos");
  assert.equal(status, 200, `GET /api/productos devolvió ${status}`);
  const list = json?.data ?? json;
  const found = (Array.isArray(list) ? list : []).find(
    (item) => item.nombre === name,
  );
  assert.ok(found, `No se encontró el producto ${name}`);
  return found;
}

async function stockOf(name) {
  const found = await product(name);
  return found.stockDisponibleUnits;
}

async function main() {
  const login = await call("POST", "/api/auth/login", {
    email: EMAIL,
    password: PASSWORD,
  });
  assert.equal(login.status, 200, `login devolvió ${login.status}`);
  assert.ok(cookies.size > 0, "login no devolvió cookies");
  step("login", { cookies: [...cookies.keys()] });

  const me = await call("GET", "/api/auth/me");
  assert.equal(me.status, 200, `auth/me devolvió ${me.status}`);
  const sucursalId = me.json?.data?.sucursalId;
  assert.ok(sucursalId, "auth/me no expone sucursal");
  step("auth/me", { sucursalId, rol: me.json?.data?.rol });

  const mate = await product("Mate Smoke");
  const termo = await product("Termo Smoke");
  step("productos", {
    mate: mate.id,
    mateStock: mate.stockDisponibleUnits,
    termo: termo.id,
    termoStock: termo.stockDisponibleUnits,
  });

  // POS efectivo: 2 x 10.01
  const cash = await call("POST", "/api/ventas", {
    items: [{ productoId: mate.id, units: 2 }],
    metodoPago: "EFECTIVO",
  });
  assert.equal(cash.status, 200, `venta efectivo devolvió ${cash.status}`);
  assert.equal(cash.json.data.total, "20.02");
  assert.equal(cash.json.pago.monto, "20.02");
  assert.equal(cash.json.data.metodoPago, "EFECTIVO");
  const cashId = cash.json.data.id;
  assert.ok(cashId, "la venta no devolvió id");
  assert.equal(await stockOf("Mate Smoke"), 8);
  step("venta efectivo", {
    ventaId: cashId,
    numeroVenta: cash.json.data.numeroVenta,
    total: cash.json.data.total,
    stock: 8,
  });

  // POS tarjeta: 2 x 5.55 con 10% de catálogo y 7.5% de recargo
  const card = await call("POST", "/api/ventas", {
    items: [{ productoId: termo.id, units: 2 }],
    metodoPago: "TARJETA",
  });
  assert.equal(card.status, 200, `venta tarjeta devolvió ${card.status}`);
  assert.equal(card.json.data.total, "10.74");
  assert.equal(card.json.pago.monto, "10.74");
  assert.equal(await stockOf("Termo Smoke"), 6);
  step("venta tarjeta", {
    ventaId: card.json.data.id,
    numeroVenta: card.json.data.numeroVenta,
    total: card.json.data.total,
    stock: 6,
  });

  // Anulación: restituye stock y marca la venta
  const cancel = await call("DELETE", `/api/ventas/${cashId}`, {
    motivo: "Smoke T15-R",
  });
  assert.ok(
    cancel.status === 200 || cancel.status === 204,
    `anulación devolvió ${cancel.status}`,
  );
  assert.equal(await stockOf("Mate Smoke"), 10);
  const cancelled = await call("GET", `/api/ventas/${cashId}`);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.json.data.anulada, true);
  step("anulación", { ventaId: cashId, stock: 10, anulada: true });

  // Consignación y liquidación total como devuelta
  const consignacion = await call("POST", "/api/consignaciones", {
    clienteId: 1,
    items: [{ productoId: mate.id, unitsEntregadas: 2 }],
  });
  assert.equal(
    consignacion.status,
    201,
    `consignación devolvió ${consignacion.status}`,
  );
  const consignacionId = consignacion.json.data.id;
  const detalleId = consignacion.json.data.detalles[0].id;
  assert.ok(consignacionId && detalleId, "consignación sin ids");
  assert.equal(await stockOf("Mate Smoke"), 8);
  step("consignación", { consignacionId, detalleId, stockDisponible: 8 });

  const liquidacion = await call(
    "POST",
    `/api/liquidaciones/consignacion/${consignacionId}`,
    {
      items: [
        {
          consignacionDetalleId: detalleId,
          unitsVendidas: 0,
          unitsDevueltas: 2,
        },
      ],
    },
  );
  assert.ok(
    liquidacion.status === 200 || liquidacion.status === 201,
    `liquidación devolvió ${liquidacion.status}`,
  );
  assert.equal(await stockOf("Mate Smoke"), 10);
  step("liquidación", { consignacionId, stock: 10 });

  // Pedido esperado: confirmar recepción suma stock
  const pedido = await call("POST", "/api/pedidos-esperados", {
    sucursalId,
    fechaEsperada: new Date(Date.now() + 86_400_000).toISOString(),
    observaciones: "Smoke T15-R",
    items: [{ productoId: mate.id, cantidadEsperada: 5 }],
  });
  assert.equal(pedido.status, 201, `pedido devolvió ${pedido.status}`);
  const pedidoId = pedido.json.data.id;
  const pedidoItemId =
    pedido.json.data.items?.[0]?.id ?? pedido.json.data.detalles?.[0]?.id;
  assert.ok(pedidoId && pedidoItemId, "pedido sin ids");

  const confirmar = await call(
    "POST",
    `/api/pedidos-esperados/${pedidoId}/confirmar`,
    { items: [{ itemId: pedidoItemId, cantidadRecibida: 5 }] },
  );
  assert.equal(
    confirmar.status,
    200,
    `confirmar pedido devolvió ${confirmar.status}`,
  );
  assert.equal(await stockOf("Mate Smoke"), 15);
  step("pedido esperado", { pedidoId, pedidoItemId, stock: 15 });

  // OCR: confirmar ítem de factura suma stock
  const ocr = await call(
    "POST",
    `/api/facturas-proveedor/items/${FACTURA_ITEM_ID}/confirm`,
    { productoId: mate.id },
  );
  assert.equal(ocr.status, 200, `confirmar ítem OCR devolvió ${ocr.status}`);
  assert.equal(await stockOf("Mate Smoke"), 18);
  step("ocr confirmar", {
    itemId: ocr.json.data?.id,
    estado: ocr.json.data?.estado,
    stock: 18,
  });

  if (DB_URL) {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();
    try {
      const authority = await client.query(
        'SELECT "modo" FROM public."StockAutoridad" WHERE "id" = 1',
      );
      const trigger = await client.query(
        `SELECT COUNT(*)::int AS count FROM pg_catalog.pg_trigger
         WHERE tgrelid = 'public."StockSucursal"'::regclass
           AND tgname = 'trg_sync_producto_stock' AND NOT tgisinternal`,
      );
      const drift = await client.query(
        `SELECT p."id",
                p."stockDisponibleUnits" AS proyectado,
                COALESCE(SUM(s."stockDisponibleUnits"), 0)::int AS suma,
                p."stockConsignadoUnits" AS "consignadoProyectado",
                COALESCE(SUM(s."stockConsignadoUnits"), 0)::int AS "consignadoSuma"
         FROM public."Producto" p
         LEFT JOIN public."StockSucursal" s ON s."productoId" = p."id"
         GROUP BY p."id"`,
      );
      const drifted = drift.rows.filter(
        (row) =>
          row.proyectado !== row.suma ||
          row.consignadoProyectado !== row.consignadoSuma,
      );
      report.drift = {
        mode: authority.rows[0]?.modo,
        trigger: trigger.rows[0]?.count,
        products: drift.rows.length,
        drifted,
      };
      assert.equal(authority.rows[0]?.modo, "DB_PROJECTION");
      assert.equal(trigger.rows[0]?.count, 1);
      assert.deepEqual(drifted, []);
    } finally {
      await client.end();
    }
    step("deriva", report.drift);
  } else {
    console.warn(
      "SMOKE_DATABASE_URL no definido: se omite la verificación de deriva",
    );
  }

  console.log("SMOKE_RESULT", JSON.stringify({ ok: true, report }));
}

main().catch((error) => {
  console.error("SMOKE_FAILED", error?.message ?? error);
  console.log("SMOKE_REPORT", JSON.stringify(report, null, 2));
  process.exitCode = 1;
});
