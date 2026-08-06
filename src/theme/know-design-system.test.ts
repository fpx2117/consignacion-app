import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  DARK_THEME,
  EXTERNAL_COLORS,
  LIGHT_THEME,
  generateThemeCss,
} from "@/theme/know-design-system";

const appDir = fileURLToPath(new URL("../app", import.meta.url));
const globalsCss = readFileSync(`${appDir}/globals.css`, "utf8");
const storefrontCss = readFileSync(`${appDir}/storefront-theme.css`, "utf8");
const externalColorsCss = readFileSync(`${appDir}/external-colors.css`, "utf8");

function assertDeclarationsPresent(
  css: string,
  vars: Record<string, string>,
  label: string,
) {
  for (const [key, value] of Object.entries(vars)) {
    const declaration = `${key}: ${value};`;
    assert.ok(
      css.includes(declaration),
      `${label} no contiene "${declaration}"`,
    );
  }
}

test("generateThemeCss arma un bloque CSS válido a partir del mapa de tokens", () => {
  const css = generateThemeCss(":root", {
    "--foo": "#111111",
    "--bar": "var(--foo)",
  });
  assert.equal(css, ":root {\n  --foo: #111111;\n  --bar: var(--foo);\n}");
});

test("LIGHT_THEME coincide con el bloque :root de globals.css", () => {
  assertDeclarationsPresent(globalsCss, LIGHT_THEME, "globals.css");
});

test("DARK_THEME coincide con el bloque .dark de globals.css", () => {
  assertDeclarationsPresent(globalsCss, DARK_THEME, "globals.css");
});

test("EXTERNAL_COLORS coincide con external-colors.css", () => {
  assertDeclarationsPresent(
    externalColorsCss,
    EXTERNAL_COLORS,
    "external-colors.css",
  );
});

test("storefront-theme.css fuerza modo claro con los mismos roles que LIGHT_THEME", () => {
  const storefrontRoles: Record<string, string> = {
    "--background": LIGHT_THEME["--background"],
    "--foreground": LIGHT_THEME["--foreground"],
    "--muted": LIGHT_THEME["--muted"],
    "--muted-foreground": LIGHT_THEME["--muted-foreground"],
    "--accent": LIGHT_THEME["--accent"],
    "--accent-foreground": LIGHT_THEME["--accent-foreground"],
    "--destructive": LIGHT_THEME["--destructive"],
    "--destructive-foreground": LIGHT_THEME["--destructive-foreground"],
    "--border": LIGHT_THEME["--border"],
    "--input": LIGHT_THEME["--input"],
    "--success": LIGHT_THEME["--success"],
    "--success-foreground": LIGHT_THEME["--success-foreground"],
  };
  assertDeclarationsPresent(
    storefrontCss,
    storefrontRoles,
    "storefront-theme.css",
  );
});

test("no quedan tokens de LIGHT_THEME o DARK_THEME sin valor", () => {
  for (const [key, value] of Object.entries({
    ...LIGHT_THEME,
    ...DARK_THEME,
  })) {
    assert.ok(value.length > 0, `${key} no puede estar vacío`);
  }
});
