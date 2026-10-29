import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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
  const secretPatterns = [
    /sk-or-v1-[A-Za-z0-9]{20,}/,
    /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@(?!localhost|127\.0\.0\.1)/i,
    /Authorization:\s*Bearer\s+[a-f0-9]{32,}/i,
  ];
  for (const file of files) {
    if (file.startsWith("scripts/security/") || file === ".env.example") continue;
    try {
      const content = fs.readFileSync(path.join(root, file), "utf8");
      if (secretPatterns.some((pattern) => pattern.test(content)))
        prohibited.push(`${file} (contiene un secreto con formato real)`);
    } catch {
      // Binary/unreadable tracked files are outside this text-secret scan.
    }
  }
  return prohibited;
}
