import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSource, compareSnapshots } from "./visual-guard-core.mjs";

const counts = (result) =>
  Object.fromEntries(
    Object.entries(result.violations).map(([key, values]) => [
      key,
      values.length,
    ]),
  );

const cleanRecord = (lines) => ({
  lines,
  violations: Object.fromEntries(
    ["colors", "paletteClasses", "legacyFonts", "legacyBrands"].map((key) => [
      key,
      [],
    ]),
  ),
});

test("detecta hardcoding visual y tipografia legacy", () => {
  const result = analyzeSource(
    "src/example.tsx",
    [
      'const color = "#1737C8";',
      'const shadow = "rgba(0, 0, 0, 0.5)";',
      'const classes = "bg-blue-500 text-white shadow-red-500/20";',
      'const font = "Poppins";',
      'const brand = "AllData POS";',
    ].join("\n"),
  );

  assert.deepEqual(counts(result), {
    colors: 2,
    paletteClasses: 3,
    legacyFonts: 1,
    legacyBrands: 2,
  });
  assert.ok(
    result.violations.paletteClasses.some((finding) =>
      finding.startsWith("text-white\0"),
    ),
  );
});

test("permite colores pero no deuda legacy en la fuente canonica", () => {
  const result = analyzeSource(
    "src/theme/know-design-system.ts",
    'export const theme = "#1737C8 Poppins text-blue-500";',
  );

  assert.equal(result.violations.colors.length, 0);
  assert.equal(result.violations.legacyFonts.length, 1);
  assert.equal(result.violations.paletteClasses.length, 1);
});

test("permite funciones derivadas de tokens y detecta colores nombrados", () => {
  const result = analyzeSource(
    "src/example.css",
    [
      ".ok { color: hsl(var(--foreground)); }",
      ".bad { box-shadow: 0 0 4px rebeccapurple; color: var(--surface, red); background-image: linear-gradient(\nblue,\nvar(--surface)); accent-color: green; filter: drop-shadow(0 0 2px yellow); text-decoration: cyan; }",
      '<path fill="orange" stop-color={"pink"} flood-color={\'gold\'} />',
    ].join("\n"),
  );

  assert.equal(result.violations.colors.length, 9);
});

test("detecta familias Tailwind adicionales y construcciones dinamicas", () => {
  const result = analyzeSource(
    "src/example.tsx",
    'const styles = "outline-red-500 placeholder-slate-400 drop-shadow-blue-500 border-t-red-500 bg-[red] bg-${tone}-500";',
  );

  assert.equal(result.violations.paletteClasses.length, 6);
});

test("detecta colores nombrados en tokens semanticos sin marcar variables", () => {
  const result = analyzeSource(
    "src/example.ts",
    [
      'const theme = { primary: "orange", surface: "white", positive: "red", brandColor: "blue", chartColors: ["green", "purple"] };',
      'const token = { color: "var(--foreground)" };',
    ].join("\n"),
  );

  assert.equal(result.violations.colors.length, 6);
});

test("detecta gradientes Tailwind con colores arbitrarios", () => {
  const result = analyzeSource(
    "src/example.tsx",
    'const styles = "hover:bg-linear-[45deg,red,blue]";',
  );
  assert.equal(result.violations.paletteClasses.length, 1);
});

test("permite Tailwind arbitrario basado solo en tokens", () => {
  const token = analyzeSource(
    "src/example.tsx",
    'const styles = "text-[color:var(--ui-fx-white)]";',
  );
  const fallback = analyzeSource(
    "src/example.tsx",
    'const styles = "text-[color:var(--text,#fff)]";',
  );
  const functionFallback = analyzeSource(
    "src/example.tsx",
    'const styles = "text-[color:var(--text,rgba(0,0,0,.5))]";',
  );
  const mixedGradient = analyzeSource(
    "src/example.tsx",
    'const styles = "bg-[linear-gradient(var(--surface),lab(50%_20_30))] bg-[linear-gradient(var(--surface),rgba(0,0,0,.5))] bg-[rgb(var(--r)_255_0)]";',
  );
  assert.equal(token.violations.paletteClasses.length, 0);
  assert.equal(fallback.violations.paletteClasses.length, 1);
  assert.equal(functionFallback.violations.paletteClasses.length, 1);
  assert.equal(mixedGradient.violations.paletteClasses.length, 3);
});

test("detecta funciones CSS modernas y permite las derivadas de tokens", () => {
  const result = analyzeSource(
    "src/example.css",
    [
      ".a { color: lab(50% 20 30); }",
      ".b { color: lch(50% 40 30); }",
      ".c { color: hwb(30 10% 20%); background: rgb(var(--r) 255 0); }",
      ".d { color: color(display-p3 1 0 0); }",
      ".e { background: linear-gradient(rgba(0,0,0,.5),var(--surface)); }",
      ".f { color: oklab(50% 20 30); }",
      ".ok { color: lab(var(--lab)); }",
    ].join("\n"),
  );
  assert.equal(result.violations.colors.length, 7);
});

test("detecta variantes de marcas legacy", () => {
  const result = analyzeSource(
    "src/example.tsx",
    'const labels = ["POS", "allData", "IMPORT.VPS", "Dashboard"];',
  );

  assert.equal(result.violations.legacyBrands.length, 4);
});

test("no confunde palabras Unicode con la fuente Inter", () => {
  const result = analyzeSource(
    "src/example.ts",
    'const labels = ["Interés", "interacción", "Inter"];',
  );
  assert.equal(result.violations.legacyFonts.length, 1);
});

test("detecta POS dentro de etiquetas visibles", () => {
  const result = analyzeSource(
    "src/example.tsx",
    '<h1>Panel POS principal</h1>\n<h2>Dashboard</h2>\nconst title = "Reporte POS diario";',
  );

  assert.equal(result.violations.legacyBrands.length, 3);
});

test("bloquea archivos nuevos mayores a 300 lineas o con deuda", () => {
  const current = {
    "src/new-clean.ts": cleanRecord(301),
    "src/new-dirty.tsx": analyzeSource(
      "src/new-dirty.tsx",
      'export const value = "text-red-500";',
    ),
  };

  const regressions = compareSnapshots(current, {});
  assert.equal(regressions.length, 2);
  assert.match(regressions[0].message, /300 lineas/i);
  assert.match(regressions[1].message, /paletteClasses/i);
});

test("aplica ratchet a todos los archivos aunque esten bajo 300 lineas", () => {
  const baseline = { "src/clean.ts": cleanRecord(40) };
  const current = { "src/clean.ts": cleanRecord(41) };

  const regressions = compareSnapshots(current, baseline);
  assert.equal(regressions.length, 1);
  assert.match(regressions[0].message, /crecio/i);
});

test("bloquea sustitucion de deuda aunque la cantidad no cambie", () => {
  const baseline = {
    "src/legacy.css": analyzeSource(
      "src/legacy.css",
      ".item { background: linear-gradient(red, blue); }",
    ),
  };
  const current = {
    "src/legacy.css": analyzeSource(
      "src/legacy.css",
      ".item { background: linear-gradient(blue, red); }",
    ),
  };

  const regressions = compareSnapshots(current, baseline);
  assert.equal(regressions.length, 1);
  assert.match(regressions[0].message, /colors/i);
});

test("bloquea mover el mismo valor entre slots de una linea", () => {
  const baseline = {
    "src/legacy.ts": analyzeSource(
      "src/legacy.ts",
      'const left = "#fff"; const right = "clean";',
    ),
  };
  const moved = {
    "src/legacy.ts": analyzeSource(
      "src/legacy.ts",
      'const left = "clean"; const right = "#fff";',
    ),
  };
  assert.equal(compareSnapshots(moved, baseline).length, 1);
});

test("bloquea intercambiar valores entre selectores con la misma propiedad", () => {
  const baseline = {
    "src/legacy.css": analyzeSource(
      "src/legacy.css",
      "const styles = css`.first\n{\n  color: red;\n}\n.second\n{\n  color: blue;\n}`;",
    ),
  };
  const moved = {
    "src/legacy.css": analyzeSource(
      "src/legacy.css",
      "const styles = css`.first\n{\n  color: blue;\n}\n.second\n{\n  color: red;\n}`;",
    ),
  };
  assert.equal(compareSnapshots(moved, baseline).length, 1);
});

test("bloquea intercambiar valores entre objetos anidados", () => {
  const baseline = {
    "src/theme.ts": analyzeSource(
      "src/theme.ts",
      'const theme = { level1: { level2: { level3: { first: { color: "red" }, second: { color: "blue" } } } } };',
    ),
  };
  const moved = {
    "src/theme.ts": analyzeSource(
      "src/theme.ts",
      'const theme = { level1: { level2: { level3: { first: { color: "blue" }, second: { color: "red" } } } } };',
    ),
  };
  assert.equal(compareSnapshots(moved, baseline).length, 1);
});

test("permite quitar un literal anterior sin sustituir el retenido", () => {
  const baseline = {
    "src/legacy.ts": analyzeSource(
      "src/legacy.ts",
      'const removed = "#fff"; const retained = "#000";',
    ),
  };
  const reduced = {
    "src/legacy.ts": analyzeSource("src/legacy.ts", 'const retained = "#000";'),
  };
  assert.deepEqual(compareSnapshots(reduced, baseline), []);
});

test("reducir deuda o eliminar archivos nunca genera regresiones", () => {
  const baseline = {
    "src/legacy.tsx": analyzeSource(
      "src/legacy.tsx",
      'const style = "#fff text-red-500";',
    ),
  };
  const reduced = {
    "src/legacy.tsx": analyzeSource(
      "src/legacy.tsx",
      'const style = "text-red-500";',
    ),
  };

  assert.deepEqual(compareSnapshots(reduced, baseline), []);
  assert.deepEqual(compareSnapshots({}, baseline), []);
});

test("reducir un color CSS no sustituye otro color de la misma linea", () => {
  const baseline = {
    "src/legacy.css": analyzeSource(
      "src/legacy.css",
      ".item { color: red; background: blue; }",
    ),
  };
  const reduced = {
    "src/legacy.css": analyzeSource(
      "src/legacy.css",
      ".item { background: blue; }",
    ),
  };

  assert.deepEqual(compareSnapshots(reduced, baseline), []);
});
