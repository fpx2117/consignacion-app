import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

// Escritores que pasan por `createVentaWithAuthority`.
//
// T25 (`9af282c`, "retire the legacy sale handler") sacó la creación directa de
// `src/app/api/ventas/register-sale-handlers.ts`: ese adaptador hoy sólo arma las
// dependencias y delega en `registerSale`, que crea la venta a través de
// `prisma-register-sale.ts`. Ese archivo ya estaba en la lista, así que la
// cobertura del límite de numeración es la misma; sólo cambió quién escribe.
//
// La invariante que importa sigue verificada aparte, al final del test:
// `directCreates` debe ser únicamente `venta-numbering-authority.ts`.
const expectedWriters = [
  "src/app/api/consignaciones/[id]/route.ts",
  "src/app/api/liquidaciones/[id]/route.ts",
  "src/app/api/liquidaciones/consignacion/[consignacionId]/route.ts",
  "src/app/api/webhooks/mercadopago/route.ts",
  "src/modules/ventas/infrastructure/prisma-register-sale.ts",
];

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) return listTypeScriptFiles(path);
    return entry.isFile() &&
      /\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/.test(path) &&
      !/\.(?:test|spec)\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/.test(path)
      ? [path]
      : [];
  });
}

test("all production Venta creates use the single authority boundary", () => {
  const directCreates: string[] = [];
  const authorityCalls: string[] = [];

  for (const path of listTypeScriptFiles("src")) {
    const source = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const ventaAliases = new Set<string>();
    const createAliases = new Set<string>();
    const isVentaDelegate = (
      node: ts.Expression,
    ): node is ts.PropertyAccessExpression | ts.ElementAccessExpression =>
      (ts.isPropertyAccessExpression(node) && node.name.text === "venta") ||
      (ts.isElementAccessExpression(node) &&
        ts.isStringLiteral(node.argumentExpression) &&
        node.argumentExpression.text === "venta");
    const isCreateAccess = (
      node: ts.Expression,
    ): node is ts.PropertyAccessExpression | ts.ElementAccessExpression =>
      (ts.isPropertyAccessExpression(node) && node.name.text === "create") ||
      (ts.isElementAccessExpression(node) &&
        ts.isStringLiteral(node.argumentExpression) &&
        node.argumentExpression.text === "create");
    const isVentaCreateAccess = (node: ts.Expression) =>
      isCreateAccess(node) &&
      (isVentaDelegate(node.expression) ||
        (ts.isIdentifier(node.expression) &&
          ventaAliases.has(node.expression.text)));
    const collectAliases = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node)) {
        if (
          ts.isIdentifier(node.name) &&
          node.initializer &&
          isVentaDelegate(node.initializer)
        ) {
          ventaAliases.add(node.name.text);
        }
        if (ts.isObjectBindingPattern(node.name)) {
          for (const element of node.name.elements) {
            const sourceName = element.propertyName ?? element.name;
            if (
              ts.isIdentifier(sourceName) &&
              sourceName.text === "venta" &&
              ts.isIdentifier(element.name)
            ) {
              ventaAliases.add(element.name.text);
            }
          }
        }
      }
      ts.forEachChild(node, collectAliases);
    };
    collectAliases(source);
    const collectCreateAliases = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node)) {
        if (
          ts.isIdentifier(node.name) &&
          node.initializer &&
          (isVentaCreateAccess(node.initializer) ||
            (ts.isCallExpression(node.initializer) &&
              ts.isPropertyAccessExpression(node.initializer.expression) &&
              node.initializer.expression.name.text === "bind" &&
              isVentaCreateAccess(node.initializer.expression.expression)))
        ) {
          createAliases.add(node.name.text);
        }
        if (
          ts.isObjectBindingPattern(node.name) &&
          node.initializer &&
          (isVentaDelegate(node.initializer) ||
            (ts.isIdentifier(node.initializer) &&
              ventaAliases.has(node.initializer.text)))
        ) {
          for (const element of node.name.elements) {
            const sourceName = element.propertyName ?? element.name;
            if (
              ts.isIdentifier(sourceName) &&
              sourceName.text === "create" &&
              ts.isIdentifier(element.name)
            ) {
              createAliases.add(element.name.text);
            }
          }
        }
      }
      ts.forEachChild(node, collectCreateAliases);
    };
    collectCreateAliases(source);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === "createVentaWithAuthority"
        ) {
          authorityCalls.push(path);
        }
        if (
          (isVentaCreateAccess(node.expression) ||
            (ts.isIdentifier(node.expression) &&
              createAliases.has(node.expression.text)))
        ) {
          directCreates.push(path);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  assert.deepEqual(authorityCalls.sort(), expectedWriters);
  assert.deepEqual(directCreates, [
    "src/modules/ventas/venta-numbering-authority.ts",
  ]);
});

test("correction locks numbering authority before deleting Venta", () => {
  const source = readFileSync("src/app/api/liquidaciones/[id]/route.ts", "utf8");
  const lockAt = source.indexOf("await assertVentaNumberingAuthority(tx);");
  const deleteAt = source.indexOf("tx.venta.delete(");
  assert.notEqual(deleteAt, -1);
  assert.ok(lockAt !== -1 && lockAt < deleteAt);
});
