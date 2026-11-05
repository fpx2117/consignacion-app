// Progreso y filtros de la revisión de factura.
//
// Extraídos de factura-proveedor-dialog.tsx (M21) sin cambios de comportamiento.

import * as React from "react";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

import type { FiltroFactura } from "./factura-proveedor-helpers";

export function FacturaProgreso({
  lineasResueltas,
  totalLineas,
  progresoPct,
}: {
  lineasResueltas: number;
  totalLineas: number;
  progresoPct: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold">
          {lineasResueltas} de {totalLineas} productos revisados
        </span>
        <span className="text-muted-foreground">
          {totalLineas - lineasResueltas === 0
            ? "Todo listo"
            : `Quedan ${totalLineas - lineasResueltas}`}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={progresoPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso de revisión de productos"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${progresoPct}%` }}
        />
      </div>
    </div>
  );
}

export function FacturaFiltros({
  conteos,
  totalLineas,
  filtroActivo,
  setFiltroActivo,
}: {
  conteos: Record<FiltroFactura, number>;
  totalLineas: number;
  filtroActivo: FiltroFactura;
  setFiltroActivo: (filtro: FiltroFactura) => void;
}) {
  return (
    <>
      <p className="flex items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm text-foreground">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <span>
          <b>{conteos.confirmado}</b> de <b>{totalLineas}</b> ya se relacionaron
          solos. Revisá los <b>{conteos.pendiente}</b> marcados — nada cambia
          hasta confirmar.
        </span>
      </p>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["todos", "Todos"],
            ["pendiente", "Pendientes"],
            ["confirmado", "Confirmados"],
            ["sin-match", "Sin match"],
            ["advertencia", "Advertencias"],
          ] as [FiltroFactura, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filtroActivo === key}
            onClick={() => setFiltroActivo(key)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors",
              filtroActivo === key
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:border-foreground/40",
            )}
          >
            {label}
            <span className="font-mono text-xs opacity-70">
              {conteos[key]}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
