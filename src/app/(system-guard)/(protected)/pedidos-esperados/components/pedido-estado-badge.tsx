"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EstadoPedidoEsperado } from "@/types/pedidos-esperados";

interface PedidoEstadoBadgeProps {
  estado: EstadoPedidoEsperado;
  size?: "sm" | "default";
}

const ESTADO_CONFIG: Record<
  EstadoPedidoEsperado,
  { label: string; className: string; dot: string }
> = {
  PROGRAMADO: {
    label: "Programado",
    className:
      "bg-[color:var(--theme-ocean-primary)]/10 text-[color:var(--theme-ocean-primary)] border-[color:var(--theme-ocean-primary)]/20 dark:text-[color:var(--theme-ocean-primary)]",
    dot: "bg-[color:var(--theme-ocean-primary)]",
  },
  VENCIDO: {
    label: "Vencido",
    className:
      "bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)] border-[color:var(--status-danger)]/20 dark:text-[color:var(--status-danger)] animate-pulse",
    dot: "bg-[color:var(--status-danger)]",
  },
  PARCIAL: {
    label: "Parcial",
    className:
      "bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400",
    dot: "bg-yellow-500",
  },
  CONFIRMADO: {
    label: "Confirmado",
    className:
      "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)]/20 dark:text-[color:var(--status-success-strong)]",
    dot: "bg-[color:var(--status-success-strong)]",
  },
  POSTERGADO: {
    label: "Postergado",
    className: "bg-muted text-muted-foreground border-border/60",
    dot: "bg-muted-foreground",
  },
  CANCELADO: {
    label: "Cancelado",
    className:
      "bg-muted/35 text-muted-foreground border-background0/20 line-through",
    dot: "bg-muted-foreground/70",
  },
};

export function PedidoEstadoBadge({
  estado,
  size = "default",
}: PedidoEstadoBadgeProps) {
  const config = ESTADO_CONFIG[estado];

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-bold border uppercase tracking-tight gap-1.5 w-fit",
        config.className,
        size === "sm" ? "text-[10px] px-1.5 py-0 h-5" : "text-xs px-2 py-0.5",
      )}
    >
      <span
        className={cn(
          "rounded-full shrink-0",
          config.dot,
          size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
        )}
      />
      {config.label}
    </Badge>
  );
}
