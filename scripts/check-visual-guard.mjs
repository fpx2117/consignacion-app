import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  VIOLATION_CATEGORIES,
  analyzeSource,
  compareSnapshots,
  isTestFile,
} from "./visual-guard-core.mjs";

const SOURCE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".mjs",
  ".scss",
  ".svg",
  ".ts",
  ".tsx",
]);
const SKIP_DIRECTORIES = new Set([
  ".claude",
  ".git",
  ".next",
  ".playwright-cli",
  "_scratch",
  "build",
  "node_modules",
  "openspec",
  "out",
  "storage",
]);
const BASELINE_PATH = "scripts/visual-guard-baseline.json";
const BASELINE_VERSION = 3;

function shouldSkipFile(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  return (
    normalized.endsWith(".d.ts") ||
    normalized.includes("/generated/") ||
    normalized.startsWith("public/uploads/")
  );
}

async function collectFiles(directory, projectRoot, files) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(absolutePath, projectRoot, files);
      continue;
    }
    const relativePath = path
      .relative(projectRoot, absolutePath)
      .replaceAll("\\", "/");
    if (
      SOURCE_EXTENSIONS.has(path.extname(entry.name)) &&
      !shouldSkipFile(relativePath)
    ) {
      files.push(relativePath);
    }
  }
}

export async function createSnapshot(projectRoot) {
  const files = [];
  await collectFiles(projectRoot, projectRoot, files);

  const snapshot = {};
  for (const filePath of [...new Set(files)].sort()) {
    const content = await fs.readFile(path.join(projectRoot, filePath), "utf8");
    snapshot[filePath] = analyzeSource(filePath, content, {
      skipVisual: isTestFile(filePath),
    });
  }
  return snapshot;
}

function serializeBaseline(snapshot) {
  const entries = Object.entries(snapshot);
  const lineRecords = entries.map(([filePath, record]) => [
    filePath,
    record.lines,
  ]);
  const violationRecords = entries.flatMap(([filePath, record]) =>
    VIOLATION_CATEGORIES.flatMap((category) => {
      const findings = record.violations[category].map((finding) =>
        finding.split("\0"),
      );
      return Array.from(
        { length: Math.ceil(findings.length / 100) },
        (_, index) => [
          filePath,
          category,
          findings.slice(index * 100, index * 100 + 100),
        ],
      );
    }),
  );
  const output = [`{"version":${BASELINE_VERSION},"lineRecords":[`];
  for (let index = 0; index < lineRecords.length; index += 20) {
    const chunk = lineRecords
      .slice(index, index + 20)
      .map(JSON.stringify)
      .join(",");
    output.push(`${chunk}${index + 20 < lineRecords.length ? "," : ""}`);
  }
  output.push('],"violationRecords":[');
  for (let index = 0; index < violationRecords.length; index += 2) {
    const chunk = violationRecords
      .slice(index, index + 2)
      .map(JSON.stringify)
      .join(",");
    output.push(`${chunk}${index + 2 < violationRecords.length ? "," : ""}`);
  }
  output.push("]}", "");
  return output.join("\n");
}

function parseBaseline(content) {
  const data = JSON.parse(content);
  if (
    data.version !== BASELINE_VERSION ||
    !Array.isArray(data.lineRecords) ||
    !Array.isArray(data.violationRecords)
  ) {
    throw new Error(
      `Baseline visual incompatible; version esperada: ${BASELINE_VERSION}.`,
    );
  }
  const snapshot = {};
  for (const record of data.lineRecords) {
    if (!Array.isArray(record) || record.length !== 2) {
      throw new Error("Baseline visual con estructura invalida.");
    }
    const [filePath, lines] = record;
    snapshot[filePath] = {
      lines,
      violations: Object.fromEntries(
        VIOLATION_CATEGORIES.map((category) => [category, []]),
      ),
    };
  }
  for (const record of data.violationRecords) {
    if (!Array.isArray(record) || record.length !== 3 || !snapshot[record[0]]) {
      throw new Error("Baseline visual con estructura invalida.");
    }
    const [filePath, category, findings] = record;
    if (!VIOLATION_CATEGORIES.includes(category) || !Array.isArray(findings)) {
      throw new Error("Baseline visual con estructura invalida.");
    }
    if (
      findings.some(
        (finding) =>
          !Array.isArray(finding) ||
          finding.length !== 3 ||
          finding.some((value) => typeof value !== "string"),
      )
    ) {
      throw new Error("Baseline visual con estructura invalida.");
    }
    snapshot[filePath].violations[category].push(
      ...findings.map((finding) => finding.join("\0")),
    );
  }
  return snapshot;
}

function snapshotsDiffer(current, baseline) {
  return JSON.stringify(current) !== JSON.stringify(baseline);
}

async function readBaseline(baselineFile) {
  return parseBaseline(await fs.readFile(baselineFile, "utf8"));
}

function failureResult(error) {
  return { ok: false, scannedFiles: 0, regressions: [], error: error.message };
}

export async function runVisualGuard(
  args = process.argv.slice(2),
  projectRoot = process.cwd(),
) {
  const baselineFile = path.join(projectRoot, BASELINE_PATH);
  const current = await createSnapshot(projectRoot);
  const update = args.includes("--update-baseline");
  const bootstrap = args.includes("--bootstrap-baseline");

  let baseline;
  try {
    baseline = await readBaseline(baselineFile);
    if (bootstrap)
      throw new Error("El baseline ya existe; bootstrap no esta permitido.");
  } catch (error) {
    if (error?.code !== "ENOENT" || !bootstrap) throw error;
    baseline = null;
  }

  const regressions = baseline ? compareSnapshots(current, baseline) : [];
  if (update || bootstrap) {
    if (regressions.length > 0) {
      return {
        ok: false,
        scannedFiles: Object.keys(current).length,
        regressions,
        error: "No se puede actualizar un baseline con regresiones.",
      };
    }
    await fs.writeFile(baselineFile, serializeBaseline(current), "utf8");
    return {
      ok: true,
      scannedFiles: Object.keys(current).length,
      regressions: [],
      updated: true,
    };
  }

  if (regressions.length === 0 && snapshotsDiffer(current, baseline)) {
    return {
      ok: false,
      scannedFiles: Object.keys(current).length,
      regressions: [],
      error: "Baseline visual desactualizado; ejecute npm run visual:baseline.",
    };
  }

  return {
    ok: regressions.length === 0,
    scannedFiles: Object.keys(current).length,
    regressions,
  };
}

function printResult(result, jsonMode) {
  if (jsonMode) {
    console.log(JSON.stringify(result));
    return;
  }
  if (result.updated) {
    console.log(
      `Baseline visual actualizado: ${result.scannedFiles} archivos.`,
    );
  } else if (result.ok) {
    console.log(`Visual guard OK: ${result.scannedFiles} archivos analizados.`);
  } else {
    result.regressions.forEach((item) =>
      console.error(`${item.filePath}: ${item.message}`),
    );
    if (result.error) console.error(result.error);
  }
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const jsonMode = process.argv.includes("--json");
  try {
    const result = await runVisualGuard();
    printResult(result, jsonMode);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    printResult(failureResult(error), jsonMode);
    process.exitCode = 2;
  }
}
