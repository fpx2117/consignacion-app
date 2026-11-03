import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

test("create-product gates stock authority before creating the product", async () => {
  const source = await readFile(
    resolve(
      "src/app/api/facturas-proveedor/items/[id]/create-product/route.ts",
    ),
    "utf8",
  );
  const gateAt = source.indexOf("await lockStockAuthority(tx);");
  const createAt = source.indexOf("const nuevoProducto = await tx.producto.create(");
  assert.ok(gateAt !== -1, "missing lockStockAuthority(tx)");
  assert.ok(createAt !== -1, "missing producto.create");
  assert.ok(gateAt < createAt, "stock authority gate must precede product create");
  assert.match(source, /error instanceof StockAuthorityError/);
  assert.match(source, /Autoridad de stock no disponible\./);
  assert.match(source, /status: 503/);
});
