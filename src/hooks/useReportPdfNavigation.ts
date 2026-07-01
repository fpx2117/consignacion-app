"use client";

import { useEffect, useState } from "react";

// Antes, las páginas de loading de reportes hacían window.location.replace(pdfUrl)
// directo: eso navega el tab AL endpoint que genera el PDF, así que el spinner
// desaparece de inmediato y el usuario ve una pestaña en blanco del navegador
// durante toda la generación real (Chromium + render, varios segundos).
// Este hook en cambio pide el PDF con fetch() mientras el spinner sigue
// montado, y solo navega cuando el blob ya está listo — el loading se ve
// durante toda la espera real, no solo un instante.
export function useReportPdfNavigation(pdfUrl: string | null): string | null {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(pdfUrl, { credentials: "include" });
        if (!res.ok) {
          let message = "No se pudo generar el reporte. Intentá nuevamente.";
          try {
            const data = await res.json();
            if (data?.error) message = data.error;
          } catch {
            // respuesta no-JSON (ej. 502 de un proxy) → se usa el mensaje default
          }
          throw new Error(message);
        }
        const blob = await res.blob();
        if (cancelled) return;
        window.location.replace(URL.createObjectURL(blob));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "No se pudo generar el reporte. Intentá nuevamente.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  return error;
}
