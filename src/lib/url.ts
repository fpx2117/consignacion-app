// src/lib/url.ts
export function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

/**
 * Une base + path sin duplicar host.
 * - Si path ya es absoluto (https://...), lo devuelve tal cual.
 * - Si path incluye accidentalmente el host sin protocolo (ej: consignacion-app.../ver/ticket/1),
 *   lo limpia.
 */
export function joinUrl(base: string, pathOrUrl: string) {
  if (!base) throw new Error("joinUrl: base is required");
  if (!pathOrUrl) return base;

  // Si ya es absoluta, no tocar
  if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl;

  // Normalizar base
  const baseClean = base.replace(/\/+$/, "");

  // Si pathOrUrl trae host pegado (sin https://), lo removemos
  // ej: "consignacion-app-production.up.railway.app/ver/ticket/1"
  const baseHost = new URL(baseClean).host;
  let p = pathOrUrl.replace(/^\/+/, "");
  p = p.replace(new RegExp(`^${baseHost}\/?`, "i"), "");
  p = p.replace(/^\/+/, "");

  return `${baseClean}/${p}`;
}
