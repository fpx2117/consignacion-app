// src/lib/ocr/matching-engine.ts
// Motor de matching por capas: intenta reconocer un item de factura contra el
// catálogo de la sucursal, en orden de confianza decreciente. Corre en el backend,
// nunca en Modal — Modal sólo extrae texto, esto decide qué producto es.
//
// Orden de capas:
//   1. Alias por proveedor+código exacto      -> score 1.0 (aprendizaje explícito)
//   2. Alias por proveedor+texto exacto        -> score 1.0 (aprendizaje explícito)
//   3. Nombre exacto normalizado en catálogo   -> score 0.98
//   4. Fuzzy (Dice) sobre nombre normalizado   -> score real, con chequeo de ambigüedad
//
// Ninguna capa dispara stock/costo por sí sola: sólo clasifica el item. La escritura
// de stock/costo/alias ocurre recién al confirmar (fase de revisión, todavía no
// implementada).

import { prisma } from "@/lib/prisma";
import { EstadoItemFactura } from "@prisma/client";
import { normalizarProducto } from "./normalizar-producto";
import { scoresFuzzy, type ProductoMatch } from "./match-producto";

export type MatchMotivo =
  "codigo_proveedor" | "alias" | "nombre_exacto" | "fuzzy" | null;

export type ResultadoMatching = {
  productoId: number | null;
  score: number | null;
  motivo: MatchMotivo;
  estado: EstadoItemFactura;
};

export type ContextoMatching = {
  productos: { id: number; nombre: string }[];
  productosPorNombreNormalizado: Map<string, number>;
  aliasPorCodigo: Map<string, number>;
  aliasPorTexto: Map<string, number>;
};

// Umbrales de clasificación (ver openspec: sección "Motor de matching").
const UMBRAL_SEGURA = 0.95;
const UMBRAL_PROBABLE = 0.85;
const UMBRAL_REVISION = 0.7;
// Si el segundo mejor candidato queda a menos de esto del primero, es ambiguo:
// se fuerza revisión manual aunque el score crudo del primero fuera "seguro".
const MARGEN_AMBIGUEDAD = 0.05;

export async function construirContextoMatching(params: {
  sucursalId: number;
  proveedorId: number | null;
}): Promise<ContextoMatching> {
  const [productos, aliasProveedor] = await Promise.all([
    prisma.producto.findMany({
      where: { sucursalId: params.sucursalId, activo: true },
      select: { id: true, nombre: true },
    }),
    params.proveedorId
      ? prisma.productoProveedorAlias.findMany({
          where: { proveedorId: params.proveedorId },
        })
      : Promise.resolve([]),
  ]);

  const productosPorNombreNormalizado = new Map<string, number>();
  for (const producto of productos) {
    const { normalizado } = normalizarProducto(producto.nombre);
    if (normalizado && !productosPorNombreNormalizado.has(normalizado)) {
      productosPorNombreNormalizado.set(normalizado, producto.id);
    }
  }

  const aliasPorCodigo = new Map<string, number>();
  const aliasPorTexto = new Map<string, number>();
  for (const alias of aliasProveedor) {
    if (alias.codigoProveedor)
      aliasPorCodigo.set(alias.codigoProveedor, alias.productoId);
    if (alias.textoNormalizado)
      aliasPorTexto.set(alias.textoNormalizado, alias.productoId);
  }

  return {
    productos,
    productosPorNombreNormalizado,
    aliasPorCodigo,
    aliasPorTexto,
  };
}

function clasificarPorScore(score: number): EstadoItemFactura {
  if (score >= UMBRAL_SEGURA) return EstadoItemFactura.COINCIDENCIA_SEGURA;
  if (score >= UMBRAL_PROBABLE) return EstadoItemFactura.COINCIDENCIA_PROBABLE;
  if (score >= UMBRAL_REVISION) return EstadoItemFactura.REQUIERE_REVISION;
  return EstadoItemFactura.SIN_COINCIDENCIA;
}

function mejorFuzzyEntreVariantes(
  normalizado: string,
  normalizadoCorregido: string,
  productos: { id: number; nombre: string }[],
): { mejor: ProductoMatch; segundo: ProductoMatch | null } | null {
  const scoresDirectos = scoresFuzzy(normalizado, productos);
  const scoresCorregidos =
    normalizadoCorregido !== normalizado
      ? scoresFuzzy(normalizadoCorregido, productos)
      : scoresDirectos;

  // Nos quedamos con la variante (directa o corregida) cuyo mejor candidato tenga
  // mayor score, y usamos SUS top-2 para el chequeo de ambigüedad.
  const candidatos =
    scoresDirectos[0] && scoresCorregidos[0]
      ? scoresDirectos[0].score >= scoresCorregidos[0].score
        ? scoresDirectos
        : scoresCorregidos
      : scoresDirectos[0]
        ? scoresDirectos
        : scoresCorregidos;

  if (!candidatos[0] || candidatos[0].score <= 0) return null;

  return { mejor: candidatos[0], segundo: candidatos[1] ?? null };
}

export function matchearItem(
  item: { textoOriginal: string; codigoProveedor: string | null },
  contexto: ContextoMatching,
): ResultadoMatching {
  // Capa 1: alias por proveedor + código exacto — la señal más confiable posible,
  // viene de una confirmación manual previa del usuario para este mismo proveedor.
  if (item.codigoProveedor) {
    const productoId = contexto.aliasPorCodigo.get(item.codigoProveedor);
    if (productoId) {
      return {
        productoId,
        score: 1,
        motivo: "codigo_proveedor",
        estado: EstadoItemFactura.COINCIDENCIA_SEGURA,
      };
    }
  }

  const { normalizado, normalizadoCorregido } = normalizarProducto(
    item.textoOriginal,
  );
  if (!normalizado) {
    return {
      productoId: null,
      score: null,
      motivo: null,
      estado: EstadoItemFactura.SIN_COINCIDENCIA,
    };
  }

  // Capa 2: alias por proveedor + texto exacto (ambas variantes de normalización)
  const aliasProductoId =
    contexto.aliasPorTexto.get(normalizado) ??
    contexto.aliasPorTexto.get(normalizadoCorregido);
  if (aliasProductoId) {
    return {
      productoId: aliasProductoId,
      score: 1,
      motivo: "alias",
      estado: EstadoItemFactura.COINCIDENCIA_SEGURA,
    };
  }

  // Capa 3: nombre exacto normalizado contra el catálogo (sin alias todavía, pero coincide letra a letra)
  const nombreExactoId =
    contexto.productosPorNombreNormalizado.get(normalizado) ??
    contexto.productosPorNombreNormalizado.get(normalizadoCorregido);
  if (nombreExactoId) {
    return {
      productoId: nombreExactoId,
      score: 0.98,
      motivo: "nombre_exacto",
      estado: EstadoItemFactura.COINCIDENCIA_SEGURA,
    };
  }

  // Capa 4: fuzzy, con chequeo de ambigüedad entre el 1° y 2° candidato
  const resultado = mejorFuzzyEntreVariantes(
    normalizado,
    normalizadoCorregido,
    contexto.productos,
  );
  if (!resultado) {
    return {
      productoId: null,
      score: 0,
      motivo: null,
      estado: EstadoItemFactura.SIN_COINCIDENCIA,
    };
  }

  const { mejor, segundo } = resultado;
  const esAmbiguo =
    segundo !== null && mejor.score - segundo.score < MARGEN_AMBIGUEDAD;
  const estado =
    esAmbiguo && mejor.score >= UMBRAL_REVISION
      ? EstadoItemFactura.REQUIERE_REVISION
      : clasificarPorScore(mejor.score);

  return {
    productoId: mejor.productoId,
    score: mejor.score,
    motivo: "fuzzy",
    estado,
  };
}
