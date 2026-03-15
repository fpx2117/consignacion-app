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
    <section className="w-full border-t border-border/40 bg-background/95 backdrop-blur-xl px-3 py-3" aria-label="Pago rapido">
      <div className="w-full max-w-2xl mx-auto space-y-3">
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
          className="w-full h-12 md:h-14 text-base md:text-lg font-black shadow-lg shadow-indigo-500/20 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl md:rounded-2xl active:scale-[0.98] transition-all focus-visible:ring-2"
          aria-label={`Cobrar venta por ${formatCurrency(totalAmount)}`}
        >
          {loading ? (
            <Loader2 className="animate-spin h-5 w-5" aria-hidden="true" />
          ) : (
            <div className="flex justify-between w-full px-2 md:px-4 items-center">
              <span className="text-[10px] md:text-xs font-bold tracking-widest opacity-80 uppercase bg-foreground/10 px-2 py-1 rounded-md">
                {cartLength} ITEMS
              </span>
              <span className="text-lg md:text-xl tracking-tight">COBRAR {formatCurrency(totalAmount)}</span>
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
