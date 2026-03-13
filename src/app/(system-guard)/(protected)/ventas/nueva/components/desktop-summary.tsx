import { Barcode, ShoppingCart } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import type { CartItem } from "../types";
import { formatCurrency } from "../utils";

type DesktopSummaryProps = {
  cart: CartItem[];
  totalSinInteres: number;
  totalDescuento: number;
  montoDescuentoGlobal: number;
  montoInteres: number;
  porcentajeInteresTarjeta: number;
  totalAmount: number;
  isTarjeta: boolean;
  descuentoTipo?: "MONTO" | "PORCENTAJE";
  descuentoValor?: number;
};

export function DesktopSummary({
  cart,
  totalSinInteres,
  totalDescuento,
  montoDescuentoGlobal,
  montoInteres,
  porcentajeInteresTarjeta,
  totalAmount,
  isTarjeta,
  descuentoTipo,
  descuentoValor,
}: DesktopSummaryProps) {
  return (
    <aside className="hidden lg:flex w-[380px] bg-background border-l border-border/40 flex-col shadow-xl z-20" aria-label="Resumen de compra">
      <div className="p-6 border-b bg-muted/10">
        <h2 className="font-black text-lg flex items-center gap-2 text-foreground tracking-tight">
          <ShoppingCart className="h-5 w-5 text-primary" aria-hidden="true" /> Resumen de Compra
        </h2>
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-1 opacity-60">
          Detalle de items facturados
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-background/50">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 gap-3">
            <div className="p-4 rounded-full border-2 border-dashed border-muted-foreground/50">
              <Barcode className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-[10px] font-black tracking-widest uppercase">Esperando items...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map((item) => (
              <div key={`${item.producto.id}-sidebar`} className="flex justify-between items-start text-sm group">
                <div className="flex gap-3 min-w-0 pr-4">
                  <span className="font-bold w-6 text-right tabular-nums text-muted-foreground shrink-0">{item.quantity}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-foreground leading-tight">{item.producto.nombre}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {formatCurrency(item.producto.precioVenta)} c/u
                    </span>
                  </div>
                </div>
                <span className="font-mono font-bold tracking-tight shrink-0">
                  {formatCurrency(item.producto.precioVenta * item.quantity)}
                </span>
              </div>
            ))}
            <Separator className="my-4 border-dashed" />
          </div>
        )}
      </div>

      <div className="p-6 bg-muted/10 border-t border-border/40 space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground font-medium">
            <span>Subtotal</span>
            <span>{formatCurrency(totalSinInteres)}</span>
          </div>
          {isTarjeta && porcentajeInteresTarjeta > 0 && (
            <div className="flex justify-between text-sm text-[color:var(--primary)] font-bold">
              <span>Interes Tarjeta ({porcentajeInteresTarjeta}%)</span>
              <span>+ {formatCurrency(montoInteres)}</span>
            </div>
          )}
          {totalDescuento > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground font-medium">
              <span>Desc. x Producto</span>
              <span className="text-[color:var(--status-success-strong)] font-bold">- {formatCurrency(totalDescuento)}</span>
            </div>
          )}
          {montoDescuentoGlobal > 0 && (
            <div className="flex justify-between text-sm text-[color:var(--status-success-strong)] font-bold">
              <span>
                Desc. General {descuentoTipo === "PORCENTAJE" ? `(${descuentoValor ?? 0}%)` : ""}
              </span>
              <span>- {formatCurrency(montoDescuentoGlobal)}</span>
            </div>
          )}
          <div className="flex justify-between items-end pt-2 border-t border-border/50">
            <span className="text-sm font-black uppercase text-muted-foreground tracking-widest">Total</span>
            <span className="text-3xl font-black text-primary tabular-nums">{formatCurrency(totalAmount)}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
