import type { EstadoFacturaProveedor } from "@/lib/apiService";
import { Badge } from "@/components/ui/badge";

const ESTADO_LABEL: Record<EstadoFacturaProveedor, string> = {
  PENDIENTE: "Pendiente",
  PROCESANDO: "Procesando",
  REQUIERE_REVISION: "Requiere revisión",
  CONFIRMADA: "Confirmada",
  CANCELADA: "Cancelada",
  ERROR: "Error",
};

const ESTADO_CLASS: Record<EstadoFacturaProveedor, string> = {
  PENDIENTE: "bg-muted text-muted-foreground",
  PROCESANDO: "bg-primary/10 text-primary",
  REQUIERE_REVISION:
    "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)]",
  CONFIRMADA:
    "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)]",
  CANCELADA:
    "bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)]",
  ERROR: "bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)]",
};

export function estadoFacturaLabel(estado: EstadoFacturaProveedor): string {
  return ESTADO_LABEL[estado] ?? estado;
}

export function estadoFacturaBadge(estado: EstadoFacturaProveedor) {
  return (
    <Badge
      variant="outline"
      className={`h-6 px-2.5 rounded-md font-bold text-[10px] border-0 ${ESTADO_CLASS[estado] ?? "bg-muted text-muted-foreground"}`}
    >
      {estadoFacturaLabel(estado).toUpperCase()}
    </Badge>
  );
}

export function formatMoneda(value: number, moneda: string): string {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: moneda === "USD" ? "USD" : "ARS",
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${moneda} ${value.toFixed(2)}`;
  }
}

export function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return "Sin fecha";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
