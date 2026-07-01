// src/lib/chromium/resolve-executable-path.ts
// Lanza Chromium para Puppeteer, compartido por el motor de OCR y los generadores
// de reportes PDF.
//
// En Railway (Linux) el `puppeteer` de npm no trae un Chromium utilizable en
// runtime, ni depender de que Nixpacks instale uno vía nix/apt es confiable
// (el "chromium" del sistema aparece y desaparece entre builds según cómo
// Nixpacks decida armar la imagen esa vez). @sparticuz/chromium empaqueta un
// binario de Chromium autocontenido pensado para este tipo de entornos, así
// que en Linux usamos ese vía puppeteer-core en vez de depender del sistema.
//
// En local (Windows/Mac) usamos el `puppeteer` de npm normal, que descarga y
// cachea su propio Chromium — comportamiento sin cambios ahí.

import type { Browser } from "puppeteer-core";

const isLinux = process.platform === "linux";

async function launchLinux(extraArgs: string[]): Promise<Browser> {
  const { default: chromium } = await import("@sparticuz/chromium");
  const { default: puppeteerCore } = await import("puppeteer-core");
  const executablePath = await chromium.executablePath();

  return puppeteerCore.launch({
    headless: true,
    executablePath,
    args: [...chromium.args, ...extraArgs],
  });
}

async function launchLocal(extraArgs: string[]): Promise<Browser> {
  const { default: puppeteer } = await import("puppeteer");
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", ...extraArgs],
  }) as unknown as Browser;
}

/**
 * Lanza Chromium para los reportes PDF (src/app/ver/**). No pasar
 * "--single-process": es inestable con Page.pdf() y puede colgar o cerrar
 * el target (verificado localmente).
 */
export async function launchReportBrowser(): Promise<Browser> {
  return isLinux ? launchLinux([]) : launchLocal([]);
}

/**
 * Lanza Chromium para el motor de OCR (rasterizado de PDF a imagen vía
 * Page.screenshot). Estos flags extra son específicos para ese caso de uso
 * y no deben reusarse en los reportes PDF.
 */
export async function launchOcrBrowser(): Promise<Browser> {
  const ocrArgs = [
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-sync",
    "--disable-translate",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-first-run",
    "--single-process",
  ];
  return isLinux ? launchLinux(ocrArgs) : launchLocal(ocrArgs);
}
