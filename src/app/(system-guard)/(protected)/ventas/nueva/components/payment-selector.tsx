import { BadgePercent } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MetodoPago } from "@/lib/types";
import type { MetodoPagoOption } from "../types";

type PaymentSelectorProps = {
  metodoPago: MetodoPago;
  opciones: MetodoPagoOption[];
  onChange: (value: MetodoPago) => void;
  onOpenDescuento: () => void;
};

export function PaymentSelector({
  metodoPago,
  opciones,
  onChange,
  onOpenDescuento,
}: PaymentSelectorProps) {
  return (
    <section aria-label="Metodo de pago" className="grid grid-cols-4 gap-2 md:gap-3">
      {opciones.map((metodo) => {
        if (metodo.value === "OTRO") {
          return (
            <button
              key="descuento"
              type="button"
              onClick={onOpenDescuento}
              className="flex flex-col items-center justify-center rounded-xl font-bold border transition-all h-[52px] md:h-[64px] bg-card border-border hover:bg-emerald-50 text-emerald-600 focus-visible:ring-2"
              aria-label="Aplicar descuento general"
            >
              <BadgePercent className="h-5 w-5 md:h-6 md:w-6 mb-1 opacity-80" aria-hidden="true" />
              <span className="text-[10px] md:text-xs tracking-wider uppercase">Desc.</span>
            </button>
          );
        }

        const Icon = metodo.icon;
        const isSelected = metodoPago === metodo.value;

        return (
          <button
            key={metodo.value}
            type="button"
            onClick={() => onChange(metodo.value)}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl font-bold border transition-all h-[52px] md:h-[64px] focus-visible:ring-2",
              isSelected
                ? "bg-primary border-primary text-primary-foreground shadow-md"
                : "bg-card border-border hover:bg-muted/50 text-muted-foreground",
            )}
            aria-label={`Seleccionar pago ${metodo.label}`}
            aria-pressed={isSelected}
          >
            <Icon className={cn("h-5 w-5 md:h-6 md:w-6 mb-1", isSelected ? "opacity-100" : "opacity-50")} aria-hidden="true" />
            <span className="text-[10px] md:text-xs tracking-wider uppercase">{metodo.label}</span>
          </button>
        );
      })}
    </section>
  );
}
