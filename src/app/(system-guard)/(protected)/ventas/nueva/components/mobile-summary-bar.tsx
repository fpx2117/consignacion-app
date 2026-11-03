import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MetodoPago } from "@/lib/types";
import type { MetodoPagoOption } from "../types";
import { formatCurrency } from "../utils";
import { PaymentSelector } from "./payment-selector";

type MobileSummaryBarProps = {
  metodoPago: MetodoPago;
  opcionesPago: MetodoPagoOption[];
  loading: boolean;
  cartLength: number;
  totalAmount: number;
  disabled: boolean;
  onMetodoPagoChange: (value: MetodoPago) => void;
  onOpenDescuento: () => void;
  onCobrar: () => void;
};

export function MobileSummaryBar({
  metodoPago,
  opcionesPago,
  loading,
  cartLength,
  totalAmount,
  disabled,
  onMetodoPagoChange,
  onOpenDescuento,
  onCobrar,
}: MobileSummaryBarProps) {
  return (
    <section
      className="w-full border-t border-border/40 bg-background/95 backdrop-blur-xl px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [@media(max-height:600px)]:px-2 [@media(max-height:600px)]:pt-2 [@media(max-height:600px)]:pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      aria-label="Pago rapido"
    >
      <div className="w-full max-w-2xl mx-auto space-y-3 [@media(max-height:600px)]:space-y-2">
        <PaymentSelector
          metodoPago={metodoPago}
          opciones={opcionesPago}
          onChange={onMetodoPagoChange}
          onOpenDescuento={onOpenDescuento}
        />
        <Button
          type="button"
          onClick={onCobrar}
          disabled={disabled}
          className="w-full h-12 md:h-14 [@media(max-height:600px)]:h-10 text-base md:text-lg font-black shadow-lg shadow-[color:var(--primary)]/20 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl md:rounded-2xl active:scale-[0.98] transition-all focus-visible:ring-2"
          aria-label={`Cobrar venta por ${formatCurrency(totalAmount)}`}
        >
          {loading ? (
            <Loader2 className="animate-spin h-5 w-5" aria-hidden="true" />
          ) : (
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 w-full px-1 min-[360px]:px-2 md:px-4 items-center">
              <span className="text-[10px] md:text-xs font-bold tracking-widest opacity-80 uppercase bg-foreground/10 px-2 py-1 rounded-md">
                {cartLength} ITEMS
              </span>
              <span className="min-w-0 truncate text-right text-sm min-[360px]:text-base md:text-xl tracking-tight">
                COBRAR {formatCurrency(totalAmount)}
              </span>
              <span className="hidden md:inline-flex items-center justify-center h-5 px-2 rounded border border-white/40 bg-white/25 text-white text-[9px] font-black font-mono tracking-tight select-none">
                F6
              </span>
            </div>
          )}
        </Button>
      </div>
    </section>
  );
}
