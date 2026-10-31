import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { sensitiveKeys } from "./secret-hygiene-keys.mjs";

const PROHIBITED = new Set([
  ".claude/settings.local.json",
  "debug_pg.js",
  "clean_db.js",
]);

export function findTrackedSecretFiles(root) {
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  const prohibited = files.filter((file) =>
    PROHIBITED.has(file.replaceAll("\\", "/")),
  );
  for (const file of files) {
    if (file === ".env.example") continue;
    try {
      const content = fs.readFileSync(path.join(root, file), "utf8");
      if (findSecretShapesInText(content).length > 0)
        prohibited.push(`${file} (contiene un secreto con formato real)`);
    } catch {
      // Binary/unreadable tracked files are outside this text-secret scan.
    }
  }
  return prohibited;
}

const placeholderPattern =
  /(change.?me|example|dev.?only|local.?dev|localhost|127\.0\.0\.1|dummy|placeholder|redacted|test.?only|\$\{|process\.env|<[^>]+>)/i;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findSecretShapesInText(content) {
  const findings = [];
  const secretPatterns = [
    /sk-or-v1-[A-Za-z0-9]{20,}/,
    /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@(?!localhost|127\.0\.0\.1)/i,
    /Authorization:\s*Bearer\s+[a-f0-9]{32,}/i,
  ];
  if (secretPatterns.some((pattern) => pattern.test(content)))
    findings.push("known-secret-shape");

  for (const key of sensitiveKeys) {
    const assignment = new RegExp(
      `["']?${escapeRegex(key)}["']?\\s*[:=]\\s*(?:["'\`]([^"'\`\\r\\n]+)["'\`]|([^\\s,;#}]+))`,
      "gm",
    );
    for (const match of content.matchAll(assignment)) {
      const value = (match[1] || match[2]).trim();
      if (value.length >= 16 && !placeholderPattern.test(value))
        findings.push(key);
    }
  }

  return findings;
}
