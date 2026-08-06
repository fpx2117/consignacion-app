import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const nextCli = require.resolve("next/dist/bin/next");

function execute(args, options = {}) {
  return spawnSync(process.execPath, args, {
    encoding: "utf8",
    stdio: "inherit",
    ...options,
  });
}

function run(args) {
  const result = execute(args);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["scripts/check-visual-guard.mjs"]);
run([
  "--test",
  "scripts/check-visual-guard.test.mjs",
  "scripts/check-visual-guard.integration.test.mjs",
]);

run([prismaCli, "generate"]);
run([nextCli, "build"]);
