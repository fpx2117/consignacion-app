import fs from "node:fs";
import path from "node:path";

const requiredExampleKeys = [
  "TZ",
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_COOKIE_NAME",
  "SHARE_LINK_SECRET",
  "PDF_SECRET",
  "CRON_SECRET",
  "SOCKET_DISPATCH_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_BASE_URL",
  "APP_URL",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "AGUSTIN_EMAIL",
  "AGUSTIN_PASSWORD",
  "MP_ACCESS_TOKEN",
  "MP_PUBLIC_KEY",
  "NEXT_PUBLIC_MP_PUBLIC_KEY",
  "MP_WEBHOOK_SECRET",
  "PAYPAL_MODE",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "PAYPAL_API_URL",
  "DEFAULT_TRIAL_DAYS",
  "PUBLIC_CHECKOUT_V2",
  "RESEND_API_KEY",
  "NEXT_PUBLIC_PLAN_1_NOMBRE",
  "NEXT_PUBLIC_PLAN_1_PRICE_ARS",
  "NEXT_PUBLIC_PLAN_1_PRICE_USD",
  "NEXT_PUBLIC_MP_PLAN_BASICO",
  "NEXT_PUBLIC_PAYPAL_PLAN_BASICO",
  "PLAN_1_MAX_PRODUCTOS",
  "PLAN_1_MAX_USUARIOS",
  "PLAN_1_ALLOW_CONSIGNACIONES",
  "PLAN_1_ALLOW_SUCURSALES",
  "NEXT_PUBLIC_PLAN_2_NOMBRE",
  "NEXT_PUBLIC_PLAN_2_PRICE_ARS",
  "NEXT_PUBLIC_PLAN_2_PRICE_USD",
  "NEXT_PUBLIC_MP_PLAN_PRO",
  "NEXT_PUBLIC_PAYPAL_PLAN_PRO",
  "PLAN_2_MAX_PRODUCTOS",
  "PLAN_2_MAX_USUARIOS",
  "PLAN_2_ALLOW_CONSIGNACIONES",
  "PLAN_2_ALLOW_SUCURSALES",
  "NEXT_PUBLIC_PLAN_3_NOMBRE",
  "NEXT_PUBLIC_PLAN_3_PRICE_ARS",
  "NEXT_PUBLIC_PLAN_3_PRICE_USD",
  "NEXT_PUBLIC_MP_PLAN_ENTERPRISE",
  "NEXT_PUBLIC_PAYPAL_PLAN_ENTERPRISE",
  "PLAN_3_MAX_PRODUCTOS",
  "PLAN_3_MAX_USUARIOS",
  "PLAN_3_ALLOW_CONSIGNACIONES",
  "PLAN_3_ALLOW_SUCURSALES",
];

const sensitiveKeys = new Set([
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_COOKIE_NAME",
  "SHARE_LINK_SECRET",
  "PDF_SECRET",
  "CRON_SECRET",
  "SOCKET_DISPATCH_SECRET",
  "ADMIN_PASSWORD",
  "AGUSTIN_PASSWORD",
  "MP_ACCESS_TOKEN",
  "MP_PUBLIC_KEY",
  "NEXT_PUBLIC_MP_PUBLIC_KEY",
  "MP_WEBHOOK_SECRET",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "RESEND_API_KEY",
]);

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
