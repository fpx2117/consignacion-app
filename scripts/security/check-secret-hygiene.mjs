import fs from "node:fs";
import path from "node:path";
import { findTrackedSecretFiles } from "./tracked-secret-files.mjs";
import { requiredExampleKeys, sensitiveKeys } from "./secret-hygiene-keys.mjs";

const placeholderMarkers = [
  "change-me",
  "change_me",
  "changeme",
  "example",
  "dev-only",
  "dev_only",
  "localonly",
  "local-dev",
  "local_dev",
  "localhost",
  "127.0.0.1",
];

const dangerousValuePatterns = [
  /APP_USR-/,
  /\bre_[A-Za-z0-9]/,
  /postgresql:\/\/.+:.+@(?!(127\.0\.0\.1|localhost))/i,
  /^[a-f0-9]{32,}$/i,
  /^P-[A-Z0-9]{10,}$/,
];

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const entries = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    entries.set(key, value);
  }

  return entries;
}

function isSafePlaceholder(key, value) {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  if (key === "PAYPAL_MODE") {
    return normalized === "sandbox" || normalized === "live";
  }

  if (key === "PAYPAL_API_URL") {
    return (
      normalized.includes("sandbox") ||
      normalized.includes("paypal.com") ||
      normalized.includes("change-me")
    );
  }

  if (!sensitiveKeys.has(key)) {
    return true;
  }

  if (placeholderMarkers.some((marker) => normalized.includes(marker))) {
    return true;
  }

  return false;
}

function hasDangerousShape(value) {
  return dangerousValuePatterns.some((pattern) => pattern.test(value));
}

const root = process.cwd();
const envPath = path.join(root, ".env");
const envExamplePath = path.join(root, ".env.example");

const problems = [];

try {
  for (const file of findTrackedSecretFiles(root))
    problems.push(`${file} es un archivo local/sensible y no debe versionarse.`);
} catch {
  problems.push("No se pudo inspeccionar la lista de archivos versionados.");
}

if (!fs.existsSync(envPath)) {
  problems.push("Falta .env en el workspace local.");
}

if (!fs.existsSync(envExamplePath)) {
  problems.push("Falta .env.example versionable para onboarding.");
}

let envEntries = new Map();
let envExampleEntries = new Map();

if (fs.existsSync(envPath)) {
  envEntries = parseEnvFile(envPath);
}

if (fs.existsSync(envExamplePath)) {
  envExampleEntries = parseEnvFile(envExamplePath);
}

for (const key of requiredExampleKeys) {
  if (!envExampleEntries.has(key)) {
    problems.push(`.env.example no declara la variable requerida ${key}.`);
  }
}

for (const [fileLabel, entries] of [
  [".env", envEntries],
  [".env.example", envExampleEntries],
]) {
  for (const [key, value] of entries) {
    if (!sensitiveKeys.has(key)) {
      continue;
    }

    if (!isSafePlaceholder(key, value)) {
      problems.push(
        `${fileLabel} contiene un valor sensible no permitido para ${key}.`,
      );
      continue;
    }

    if (
      hasDangerousShape(value) &&
      !placeholderMarkers.some((marker) => value.toLowerCase().includes(marker))
    ) {
      problems.push(
        `${fileLabel} contiene un valor con forma de secreto real para ${key}.`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error("Secret hygiene check failed:\n");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Secret hygiene check passed.");
