import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runVisualGuard } from "./check-visual-guard.mjs";

async function createFixture() {
  const root = await fs.mkdtemp(path.join(tmpdir(), "visual-guard-"));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "scripts"), { recursive: true });
  await fs.mkdir(path.join(root, "public"), { recursive: true });
  await fs.writeFile(
    path.join(root, "src", "clean.ts"),
    "export const ok = true;\n",
  );
  await fs.writeFile(
    path.join(root, "public", "icon.svg"),
    '<svg><path fill="currentColor" /></svg>\n',
  );
  return root;
}

test("descubre fuentes y bloquea actualizar baseline con regresiones", async () => {
  const root = await createFixture();
  try {
    const bootstrap = await runVisualGuard(["--bootstrap-baseline"], root);
    assert.equal(bootstrap.ok, true);
    const baselinePath = path.join(
      root,
      "scripts",
      "visual-guard-baseline.json",
    );
    const baselineBefore = await fs.readFile(baselinePath, "utf8");
    const baselineData = JSON.parse(baselineBefore);
    assert.equal(baselineData.version, 3);
    assert.ok(Array.isArray(baselineData.lineRecords));
    assert.ok(Array.isArray(baselineData.violationRecords));

    await fs.writeFile(
      path.join(root, "public", "icon.svg"),
      '<svg><path fill="red" /></svg>\n',
    );
    await fs.writeFile(
      path.join(root, "src", "oversized.test.ts"),
      "const value = true;\n".repeat(301),
    );
    const check = await runVisualGuard([], root);
    assert.equal(check.ok, false);
    assert.ok(
      check.regressions.some(({ filePath }) => filePath === "public/icon.svg"),
    );
    assert.ok(
      check.regressions.some(
        ({ filePath }) => filePath === "src/oversized.test.ts",
      ),
    );

    const update = await runVisualGuard(["--update-baseline"], root);
    assert.equal(update.ok, false);
    assert.equal(await fs.readFile(baselinePath, "utf8"), baselineBefore);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("exige actualizar baseline tras reducciones, altas limpias o bajas", async () => {
  const root = await createFixture();
  const legacyFile = path.join(root, "src", "legacy.tsx");
  const nestedDirectory = path.join(root, "prisma");
  const nestedFile = path.join(nestedDirectory, "seed.ts");
  try {
    await fs.writeFile(legacyFile, 'const style = "text-red-500";\n');
    assert.equal(
      (await runVisualGuard(["--bootstrap-baseline"], root)).ok,
      true,
    );

    await fs.writeFile(legacyFile, "export const clean = true;\n");
    const reduced = await runVisualGuard([], root);
    assert.equal(reduced.ok, false);
    assert.match(reduced.error, /desactualizado/i);
    assert.equal((await runVisualGuard(["--update-baseline"], root)).ok, true);

    await fs.mkdir(nestedDirectory);
    await fs.writeFile(nestedFile, "export default {};\n");
    const added = await runVisualGuard([], root);
    assert.equal(added.ok, false);
    assert.match(added.error, /desactualizado/i);
    assert.equal((await runVisualGuard(["--update-baseline"], root)).ok, true);

    await fs.rm(nestedFile);
    const removed = await runVisualGuard([], root);
    assert.equal(removed.ok, false);
    assert.match(removed.error, /desactualizado/i);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("modo JSON responde JSON valido cuando falta el baseline", async () => {
  const root = await createFixture();
  const cli = fileURLToPath(
    new URL("./check-visual-guard.mjs", import.meta.url),
  );
  try {
    const result = spawnSync(process.execPath, [cli, "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    const output = JSON.parse(result.stdout);
    assert.equal(result.status, 2);
    assert.equal(output.ok, false);
    assert.match(output.error, /baseline/i);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
