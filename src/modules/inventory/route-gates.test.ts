import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

async function readSource(path: string) {
  return readFile(resolve(path), "utf8");
}

function assertGateBefore(
  source: string,
  gate: string,
  transition: string,
  label: string,
) {
  const gateAt = source.indexOf(gate);
  const transitionAt = source.indexOf(transition);
  assert.ok(gateAt !== -1, `${label}: missing ${gate}`);
  assert.ok(transitionAt !== -1, `${label}: missing ${transition}`);
  assert.ok(gateAt < transitionAt, `${label}: gate must precede transition`);
  assert.match(source, /error instanceof StockAuthorityError/);
  assert.match(source, /Autoridad de stock no disponible\./);
  assert.match(source, /status: 503/);
}

test("pedido confirmation gates authority before incrementing stock", async () => {
  const source = await readSource(
    "src/app/api/pedidos-esperados/[id]/confirmar/route.ts",
  );
  assertGateBefore(
    source,
    "await lockStockAuthority(tx);",
    "incrementBranchStock(tx, stockAuthority",
    "pedidos",
  );
});

test("Mercado Pago checkout gates authority before decrementing stock", async () => {
  const source = await readSource(
    "src/app/api/webhooks/mercadopago/route.ts",
  );
  assertGateBefore(
    source,
    "await lockStockAuthority(tx);",
    "decrementBranchStock(tx, stockAuthority",
    "mercadopago",
  );
});
