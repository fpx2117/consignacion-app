import crypto from "node:crypto";
import {
  enclosingIdentity,
  findFunctionCalls,
  isTokenDerivedColor,
  structuralSlot,
} from "./visual-guard-lexer.mjs";

export const MAX_MANUAL_LINES = 300;
export const VIOLATION_CATEGORIES = [
  "colors",
  "paletteClasses",
  "legacyFonts",
  "legacyBrands",
];

const FULL_EXEMPT_PATHS = new Set([
  "scripts/check-visual-guard.mjs",
  "scripts/visual-guard-core.mjs",
]);
const COLOR_EXEMPT_PATHS = new Set(["src/theme/know-design-system.ts"]);
const COLOR_NAMES = new Set(
  "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(
    " ",
  ),
);

const HEX_COLOR = /#[\da-f]{3,8}\b/gi;
const COLOR_FUNCTIONS = new Set([
  "color",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "rgb",
  "rgba",
]);
const DECLARATION_COLOR_CONTEXT =
  /(?<![\w-])(?:--[\w-]+|[a-z][\w-]*)\s*:\s*([^;}]+)/gi;
const ATTRIBUTE_COLOR_CONTEXT =
  /(?<![\w-])(?:(?:[a-z]+-)*color|fill|stroke)\s*=\s*(?:["']([^"']+)["']|\{\s*["']([^"']+)["']\s*\})/gi;
const COLOR_ARRAY_CONTEXT =
  /\b[\w-]*(?:colors?|palette)[\w-]*\s*=\s*\[([^\]\n]+)\]/gi;
const PALETTE_FAMILIES =
  "accent|bg|border(?:-[trblxyse])?|caret|decoration|divide|drop-shadow|fill|from|outline|placeholder|ring-offset|ring|shadow|stroke|text|to|via";
const PALETTE_NAMES =
  "amber|black|blue|cyan|emerald|fuchsia|gray|green|indigo|lime|neutral|orange|pink|purple|red|rose|sky|slate|stone|teal|violet|white|yellow|zinc";
const PALETTE_CLASS = new RegExp(
  `\\b(?:${PALETTE_FAMILIES})-(?:${PALETTE_NAMES})(?:-\\d{2,3})?(?:\\/\\d{1,3})?\\b`,
  "gi",
);
const DYNAMIC_PALETTE_CLASS = new RegExp(
  `\\b(?:${PALETTE_FAMILIES})-\\$\\{[^}]+\\}(?:-\\d{2,3})?`,
  "gi",
);
const ARBITRARY_PALETTE = new RegExp(
  `\\b(?:${PALETTE_FAMILIES})(?:-(?:linear|radial|conic))?-\\[[^\\]\\n]+\\]`,
  "gi",
);
const COLOR_NAME_PATTERN = new RegExp(
  `\\b(?:${[...COLOR_NAMES].join("|")})\\b`,
  "i",
);
const LEGACY_FONT =
  /(?<![\p{L}\p{N}_])(?:Geist(?:_Mono)?|Inter|Poppins)(?![\p{L}\p{N}_])/giu;
const LEGACY_BRANDS = [
  /\bAllData\b/gi,
  /["'`][^"'`\n]*\bPOS\b[^"'`\n]*["'`]/g,
  /["'`][^"'`\n]*\bDashboard\b[^"'`\n]*["'`]/gi,
  /<[^>]+>[^<]*\bPOS\b[^<]*</g,
  /<[^>]+>[^<]*\bDashboard\b[^<]*</gi,
  /import\.vps/gi,
];

function countLines(content) {
  if (!content) return 0;
  return content.replace(/\r?\n$/, "").split(/\r?\n/).length;
}

function hashFinding(category, value, context, occurrence) {
  const normalizedValue = value.trim().replace(/\s+/g, " ");
  const digest = crypto
    .createHash("sha256")
    .update(
      `${category}\0${normalizedValue}\0${context.trim().replace(/\s+/g, " ")}\0${occurrence}`,
    )
    .digest("hex")
    .slice(0, 12);
  const normalizedContext = context.trim().replace(/\s+/g, " ");
  return `${normalizedValue.slice(0, 48)}\0${normalizedContext.slice(0, 48)}\0${digest}`;
}

function findingContext(content, index, value) {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  const lineEnd = content.indexOf("\n", index);
  const line = content.slice(
    lineStart,
    lineEnd === -1 ? content.length : lineEnd,
  );
  const prefix = line.slice(0, index - lineStart);
  const property = prefix.match(/(?:--[\w-]+|[a-z][\w-]*)\s*(?::|=)\s*$/i);
  if (property) {
    const identity = enclosingIdentity(content, index);
    return identity ? `${identity}|${property[0]}` : property[0];
  }
  const quotedValue = /(["'`])(?:\\.|(?!\1).)*\1/g;
  let quoteStart = -1;
  for (const match of line.matchAll(quotedValue)) {
    const relativeIndex = index - lineStart;
    if (
      match.index <= relativeIndex &&
      relativeIndex < match.index + match[0].length
    ) {
      quoteStart = match.index;
      break;
    }
  }
  if (quoteStart >= 0) {
    const assignment = line
      .slice(0, quoteStart)
      .match(/[a-z_$][\w$-]*\s*(?::|=)\s*$/i);
    if (assignment) {
      const identity = enclosingIdentity(content, index);
      return identity ? `${identity}|${assignment[0]}` : assignment[0];
    }
  }
  const withoutStringValues = line.replace(
    quotedValue,
    (value) => `${value[0]}<string>${value[0]}`,
  );
  return withoutStringValues === line
    ? line.replace(value, "<visual-value>")
    : withoutStringValues;
}

function collectFindings(content, matches, category, filter = () => true) {
  const occurrences = new Map();
  const findings = [];
  for (const match of matches) {
    if (!filter(match)) continue;
    const value = match[0];
    const context = findingContext(content, match.index, value);
    const key = `${value}\0${context}`;
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    findings.push(hashFinding(category, value, context, occurrence));
  }
  return findings;
}

function collectRegexFindings(content, pattern, category, filter) {
  return collectFindings(content, content.matchAll(pattern), category, filter);
}

function collectNamedColors(content) {
  const contexts = [
    DECLARATION_COLOR_CONTEXT,
    ATTRIBUTE_COLOR_CONTEXT,
    COLOR_ARRAY_CONTEXT,
  ];
  const values = [];
  for (const pattern of contexts) {
    for (const match of content.matchAll(pattern)) {
      const rawValue = match.slice(1).find(Boolean) ?? "";
      const valueIndex = match.index + match[0].indexOf(rawValue);
      const withoutVariables = rawValue.replace(/var\(\s*--[\w-]+/gi, (value) =>
        " ".repeat(value.length),
      );
      const words = [...withoutVariables.matchAll(/[a-z]+/gi)];
      values.push(
        ...words
          .filter((word) => COLOR_NAMES.has(word[0].toLowerCase()))
          .map((word) => ({
            word: word[0].toLowerCase(),
            context: `${findingContext(content, valueIndex + word.index, word[0])}|slot:${structuralSlot(rawValue, word.index)}`,
          })),
      );
    }
  }
  const occurrences = new Map();
  return values.map(({ word, context }) => {
    const key = `${word}\0${context}`;
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    return hashFinding("colors", word, context, occurrence);
  });
}

function emptyViolations() {
  return {
    colors: [],
    paletteClasses: [],
    legacyFonts: [],
    legacyBrands: [],
  };
}

export function analyzeSource(filePath, content, { skipVisual = false } = {}) {
  const normalizedPath = filePath.replaceAll("\\", "/");
  const violations = emptyViolations();
  if (skipVisual || FULL_EXEMPT_PATHS.has(normalizedPath)) {
    return { lines: countLines(content), violations };
  }

  if (!COLOR_EXEMPT_PATHS.has(normalizedPath)) {
    violations.colors = [
      ...collectRegexFindings(content, HEX_COLOR, "colors"),
      ...collectFindings(
        content,
        findFunctionCalls(content, COLOR_FUNCTIONS),
        "colors",
        (match) => !isTokenDerivedColor(match.args),
      ),
      ...collectNamedColors(content),
    ].sort();
  }
  violations.paletteClasses = [
    ...collectRegexFindings(content, PALETTE_CLASS, "paletteClasses"),
    ...collectRegexFindings(content, DYNAMIC_PALETTE_CLASS, "paletteClasses"),
    ...collectRegexFindings(
      content,
      ARBITRARY_PALETTE,
      "paletteClasses",
      (match) => {
        const withoutTokenNames = match[0].replace(
          /var\(\s*--[\w-]+/gi,
          "var(",
        );
        return (
          /#[\da-f]{3,8}\b/i.test(withoutTokenNames) ||
          findFunctionCalls(match[0], COLOR_FUNCTIONS).some(
            (call) => !isTokenDerivedColor(call.args),
          ) ||
          COLOR_NAME_PATTERN.test(withoutTokenNames)
        );
      },
    ),
  ].sort();
  violations.legacyFonts = collectRegexFindings(
    content,
    LEGACY_FONT,
    "legacyFonts",
  ).sort();
  violations.legacyBrands = LEGACY_BRANDS.flatMap((pattern) =>
    collectRegexFindings(content, pattern, "legacyBrands"),
  ).sort();

  return { lines: countLines(content), violations };
}

function multiset(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function newFindingCount(current, baseline) {
  const previous = multiset(baseline);
  let added = 0;
  for (const [value, count] of multiset(current)) {
    added += Math.max(0, count - (previous.get(value) ?? 0));
  }
  return added;
}

export function compareSnapshots(current, baseline) {
  const regressions = [];
  for (const [filePath, record] of Object.entries(current).sort()) {
    const previous = baseline[filePath];
    if (!previous) {
      if (record.lines > MAX_MANUAL_LINES) {
        regressions.push({
          filePath,
          type: "lines",
          message: `archivo nuevo supera ${MAX_MANUAL_LINES} lineas (${record.lines})`,
        });
      }
    } else if (record.lines > previous.lines) {
      regressions.push({
        filePath,
        type: "lines",
        message: `crecio de ${previous.lines} a ${record.lines} lineas`,
      });
    }

    for (const category of VIOLATION_CATEGORIES) {
      const added = newFindingCount(
        record.violations[category],
        previous?.violations[category] ?? [],
      );
      if (added > 0) {
        regressions.push({
          filePath,
          type: category,
          message: `${category} incorpora ${added} hallazgo(s) nuevo(s)`,
        });
      }
    }
  }
  return regressions;
}

export function isTestFile(filePath) {
  return /\.(?:spec|test)\.[^.]+$/.test(filePath.replaceAll("\\", "/"));
}
