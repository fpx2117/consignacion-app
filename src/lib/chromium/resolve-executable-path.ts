// src/lib/chromium/resolve-executable-path.ts
// Resuelve el binario de Chromium a usar con Puppeteer, compartido por el motor de
// OCR y los generadores de reportes PDF. En Railway el `puppeteer` de npm no trae
// un Chromium utilizable en runtime; ahí se instala Chromium nativo vía apt y se
// apunta PUPPETEER_EXECUTABLE_PATH (o se resuelve por las rutas típicas de apt).
// En local (Windows/Mac/Linux sin esas rutas) devuelve undefined y Puppeteer usa
// el Chromium que descarga por su cuenta — comportamiento sin cambios ahí.

import { existsSync } from "fs";

export function getChromiumExecutablePath(): string | undefined {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ].filter(Boolean) as string[];

  const found = candidates.find((cand) => existsSync(cand));
  if (found) {
    console.log("[Chromium] Resuelto en:", found);
  }
  return found;
}
