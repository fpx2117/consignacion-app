// src/lib/ai/catalogo-global-client.ts
// Cliente HTTP hacia catalogo-global-api (servicio separado, propia base de
// datos y deploy — ver openspec/changes/catalogo-global-api). Se usa como
// tercera fuente de matching, post-hoc: process/route.ts lo consulta solo
// para items sin match local (mismo criterio que "requiereAlta" en el
// diálogo de revisión), nunca antes ni en reemplazo del matching existente.
//
// Feature-off por ausencia de configuración (sin flag booleano separado que
// mantener): si CATALOGO_API_URL no está seteada, degrada a [] sin intentar
// nada. Nunca lanza — cualquier falla (timeout, 5xx, red caída) también
// degrada a [] y solo logea un warning, para no bloquear el procesamiento de
// una factura por una dependencia externa caída.

export type CandidatoGlobal = {
  id: string;
  codigoBarras: string | null;
  nombreNormalizado: string;
  marca: string | null;
  presentacion: string | null;
  categoria: string | null;
  score: number;
};

export async function buscarCandidatosGlobales(params: {
  rubro: string;
  descripcion: string;
  categoriaHint?: string;
  limit?: number;
}): Promise<CandidatoGlobal[]> {
  const baseUrl = process.env.CATALOGO_API_URL;
  if (!baseUrl) return [];

  const timeoutMs = Number(process.env.CATALOGO_API_TIMEOUT_MS) || 2000;

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/catalogo/ocr-candidatos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CATALOGO_API_KEY}`,
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`catalogo-global-api respondió ${res.status}`);
    }

    const data = (await res.json()) as { candidatos?: unknown };
    return Array.isArray(data.candidatos) ? (data.candidatos as CandidatoGlobal[]) : [];
  } catch (error) {
    console.warn("[catalogo-global-client] no disponible, continuando sin candidatos globales", {
      rubro: params.rubro,
      error: error instanceof Error ? error.message : error,
    });
    return [];
  }
}
