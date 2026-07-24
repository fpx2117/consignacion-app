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

// F1=Buscar producto  F2=Efectivo  F3=Transf  F4=Tarjeta  F5=Descuento  F6=Cobrar  F7=Clientes  Supr=Borrar último
const FK_MAP: Record<string, string> = {
  EFECTIVO: "F2",
  TRANSFERENCIA: "F3",
  TARJETA: "F4",
  OTRO: "F5",
};

export function PaymentSelector({
  metodoPago,
  opciones,
  onChange,
  onOpenDescuento,
}: PaymentSelectorProps) {
  return (
    <section
      aria-label="Metodo de pago"
      className="grid grid-cols-4 gap-2 md:gap-3"
    >
      {opciones.map((metodo) => {
        if (metodo.value === "OTRO") {
          return (
            <button
              key="descuento"
              type="button"
              onClick={onOpenDescuento}
              className="relative flex flex-col items-center justify-center gap-0.5 rounded-xl font-bold border transition-all h-[62px] md:h-[72px] bg-card border-border hover:bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)] focus-visible:ring-2"
              aria-label="Aplicar descuento general (F5)"
            >
              <BadgePercent className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] tracking-wider uppercase font-bold">
                Desc.
              </span>
              <FKeyBadge label="F5" active={false} />
            </button>
          );
        }

        const Icon = metodo.icon;
        const isSelected = metodoPago === metodo.value;
        const fkey = FK_MAP[metodo.value];

        return (
          <button
            key={metodo.value}
            type="button"
            onClick={() => onChange(metodo.value)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 rounded-xl font-bold border transition-all h-[62px] md:h-[72px] focus-visible:ring-2",
              isSelected
                ? "bg-primary border-primary text-primary-foreground shadow-md"
                : "bg-card border-border hover:bg-muted/50 text-muted-foreground",
            )}
            aria-label={`Seleccionar pago ${metodo.label} (${fkey})`}
            aria-pressed={isSelected}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                isSelected ? "opacity-100" : "opacity-60",
              )}
              aria-hidden="true"
            />
            <span className="text-[10px] tracking-wider uppercase">
              {metodo.label}
            </span>
            <FKeyBadge label={fkey} active={isSelected} />
          </button>
        );
      })}
    </section>
  );
}

// ── Badge de tecla de función — visible dentro del botón ─────────────────────
function FKeyBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={cn(
        "hidden md:inline-flex items-center justify-center rounded px-1.5 h-4 text-[9px] font-black font-mono border select-none tracking-tight",
        active
          ? "bg-white/25 border-white/40 text-white"
          : "bg-background/70 border-border text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
