import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const nextCli = require.resolve("next/dist/bin/next");
const tsxCli = require.resolve("tsx/cli");

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

run([tsxCli, "--test", "src/theme/know-design-system.test.ts"]);

run([prismaCli, "generate"]);
run([nextCli, "build"]);
