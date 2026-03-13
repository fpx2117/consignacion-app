/* eslint-disable */
// @ts-nocheck
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
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  VENCIDO: {
    label: "Vencido",
    className: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400 animate-pulse",
    dot: "bg-red-500",
  },
  PARCIAL: {
    label: "Parcial",
    className: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400",
    dot: "bg-yellow-500",
  },
  CONFIRMADO: {
    label: "Confirmado",
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  POSTERGADO: {
    label: "Postergado",
    className: "bg-muted text-muted-foreground border-border/60",
    dot: "bg-muted-foreground",
  },
  CANCELADO: {
    label: "Cancelado",
    className: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20 line-through",
    dot: "bg-zinc-400",
  },
};

export function PedidoEstadoBadge({ estado, size = "default" }: PedidoEstadoBadgeProps) {
  const config = ESTADO_CONFIG[estado];

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-bold border uppercase tracking-tight gap-1.5 w-fit",
        config.className,
        size === "sm" ? "text-[10px] px-1.5 py-0 h-5" : "text-xs px-2 py-0.5"
      )}
    >
      <span className={cn("rounded-full shrink-0", config.dot, size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2")} />
      {config.label}
    </Badge>
  );
}
