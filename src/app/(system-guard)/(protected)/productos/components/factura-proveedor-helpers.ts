// Helpers de presentación del diálogo de facturas de proveedor.
//
// Extraídos de factura-proveedor-dialog.tsx (M08) sin cambios de comportamiento:
// son funciones puras y constantes de UI que no dependen de estado ni de hooks.
// Mantenerlas acá permite testearlas y deja el componente más chico.

import {
  CheckCircle2,
  HelpCircle,
  Sparkles,
  XCircle,
} from "lucide-react";

import type { FacturaProveedorItem } from "@/lib/apiService";

export const ESTADOS_TERMINALES = new Set([
  "CONFIRMADO",
  "PRODUCTO_CREADO",
  "IGNORADO",
]);

export function badgeEstado(item: FacturaProveedorItem) {
  switch (item.estado) {
    case "COINCIDENCIA_SEGURA":
      return {
        label: `${item.producto?.nombre ?? "Producto sugerido"} (${Math.round((item.matchScore ?? 0) * 100)}%)`,
        cls: "text-[color:var(--status-success-strong)]",
        icon: CheckCircle2,
      };
    case "COINCIDENCIA_PROBABLE":
      return {
        label: `${item.producto?.nombre ?? "Producto sugerido"} (${Math.round((item.matchScore ?? 0) * 100)}%)`,
        cls: "text-[color:var(--status-success-strong)]",
        icon: CheckCircle2,
      };
    case "REQUIERE_REVISION":
      return {
        label: "Revisar manualmente",
        cls: "text-[color:var(--status-warning)]",
        icon: HelpCircle,
      };
    case "SIN_COINCIDENCIA":
      return {
        label: "Sin coincidencia",
        cls: "text-muted-foreground",
        icon: XCircle,
      };
    case "CONFIRMADO":
      return {
        label: "Confirmado",
        cls: "text-[color:var(--status-success-strong)]",
        icon: CheckCircle2,
      };
    case "PRODUCTO_CREADO":
      return {
        label: "Producto creado",
        cls: "text-[color:var(--status-success-strong)]",
        icon: Sparkles,
      };
    case "IGNORADO":
      return { label: "Ignorado", cls: "text-muted-foreground", icon: XCircle };
    default:
      return {
        label: "Pendiente",
        cls: "text-muted-foreground",
        icon: HelpCircle,
      };
  }
}

export function normalizarNombreSugerido(textoOriginal: string): string {
  return textoOriginal.trim();
}

export function inferirCodigoBarra(item: FacturaProveedorItem): string | null {
  const candidato = item.codigoProveedor?.trim() ?? "";
  if (!/^\d{8,14}$/.test(candidato)) return null;
  return candidato;
}

export type FiltroFactura =
  | "todos"
  | "pendiente"
  | "confirmado"
  | "sin-match"
  | "advertencia";

// Nivel de confianza del match para el chip de la tabla. Deriva del matchScore
// que ya calcula el motor de matching (0..1); un item sin producto asociado no
// tiene confianza real, se muestra como "baja".
export type NivelConfianza = "excelente" | "buena" | "baja";

export function nivelConfianza(item: FacturaProveedorItem): {
  nivel: NivelConfianza;
  pct: number | null;
} {
  if (!item.productoId) return { nivel: "baja", pct: null };
  const pct = Math.round((item.matchScore ?? 0) * 100);
  if (pct >= 95) return { nivel: "excelente", pct };
  if (pct >= 70) return { nivel: "buena", pct };
  return { nivel: "baja", pct };
}

// Agrupa el estado del item en los buckets que usan los filtros de la pantalla.
export function bucketsDeItem(item: FacturaProveedorItem): FiltroFactura[] {
  const buckets: FiltroFactura[] = [];
  const terminal = ESTADOS_TERMINALES.has(item.estado);
  if (item.estado === "CONFIRMADO" || item.estado === "PRODUCTO_CREADO") {
    buckets.push("confirmado");
  } else if (item.estado !== "IGNORADO") {
    buckets.push("pendiente");
  }
  if (!terminal && item.estado === "SIN_COINCIDENCIA")
    buckets.push("sin-match");
  if (item.advertencias.length > 0) buckets.push("advertencia");
  return buckets;
}

export const TIPS_FOTO: { ok: boolean; texto: string }[] = [
  { ok: true, texto: "Buena iluminación" },
  { ok: true, texto: "Texto legible" },
  { ok: true, texto: "Factura completa visible" },
  { ok: false, texto: "Sin reflejos ni sombras" },
  { ok: false, texto: "No capturas de pantalla" },
];

export const ACCEPT_FACTURA = "image/png,image/jpeg,image/webp,application/pdf";

// Campos del rediseño de la pantalla de revisión (grilla de datos y celdas de
// la tabla). Mismo lenguaje visual de la app (rounded-xl, shadow-xs) pero
// compactos para que la tabla respire.
export const DATO_FIELD_CLASS =
  "h-10 rounded-xl border-border bg-background text-sm shadow-xs";

export const TABLE_ACTION_ICON_CLASS =
  "size-8 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-primary/60";

export type FacturaProveedorItemConCatalogoGlobal = FacturaProveedorItem & {
  candidatoGlobalNombre?: string | null;
  candidatoGlobalCodigoBarras?: string | null;
  candidatoGlobalScore?: number | null;
};
