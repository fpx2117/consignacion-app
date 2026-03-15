import { BadgePercent, Minus, Package, Plus, Trash2 } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import type { CartItem } from "../types";
import { formatCurrency } from "../utils";

type CartItemCardProps = {
  item: CartItem;
  index: number;
  totalSubQty: number;
  bestDiscountPct: number | null;
  nextDiscountPct: number | null;
  nextDiscountQty: number | null;
  subcategoriaNombre: string;
  isLast: boolean;
  onRemove: (productId: number) => void;
  onUpdateQuantity: (productId: number, delta: number) => void;
};

export function CartItemCard({
  item,
  totalSubQty,
  bestDiscountPct,
  nextDiscountPct,
  nextDiscountQty,
  subcategoriaNombre,
  isLast,
  onRemove,
  onUpdateQuantity,
}: CartItemCardProps) {
  const precioUnit = Number(item.producto.precioVenta);
  const subtotalBruto = precioUnit * item.quantity;
  const subtotalNeto = bestDiscountPct
    ? subtotalBruto * (1 - bestDiscountPct / 100)
    : subtotalBruto;
  const maxStock = item.producto.stockDisponibleUnits ?? 9999;

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card shadow-sm transition-all p-3 space-y-2",
        "border-border/50 hover:border-primary/20",
        isLast && "ring-1 ring-primary/20"
      )}
    >
      {/* ── Fila 1: thumbnail + nombre + precio unitario ───────────── */}
      <div className="flex items-center gap-3">

        {/* Thumbnail */}
        <div className="h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 bg-muted border border-border/40 relative">
          {item.producto.imagenUrl ? (
            <Image
              src={item.producto.imagenUrl}
              alt={item.producto.nombre}
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <Package className="h-4 w-4 text-muted-foreground/30" aria-hidden="true" />
          )}
        </div>

        {/* Nombre + precio unitario — ocupa todo el ancho restante */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground leading-tight truncate">
            {item.producto.nombre}
          </p>
          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
            {formatCurrency(precioUnit)}<span className="opacity-50"> / u.</span>
            {bestDiscountPct && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-[color:var(--status-success-strong)]">
                <BadgePercent className="h-2.5 w-2.5" aria-hidden="true" />
                {`-${bestDiscountPct}%`}
              </span>
            )}
            {!bestDiscountPct && nextDiscountPct && nextDiscountQty && (
              <span className="ml-1.5 text-[10px] text-muted-foreground/40">
                {`${nextDiscountQty}+ → -${nextDiscountPct}%`}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Fila 2: stepper + subtotal + eliminar ──────────────────── */}
      <div className="flex items-center justify-between gap-2">

        {/* Stepper */}
        <div className="flex items-center gap-0 bg-muted border border-border/60 rounded-xl overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => item.quantity <= 1 ? onRemove(item.producto.id) : onUpdateQuantity(item.producto.id, -1)}
            className={cn(
              "h-8 w-8 flex items-center justify-center transition-colors",
              item.quantity <= 1
                ? "text-[color:var(--status-danger)]/60 hover:bg-[color:var(--status-danger)]/10 hover:text-[color:var(--status-danger)]"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
            aria-label={item.quantity <= 1 ? `Quitar ${item.producto.nombre}` : "Reducir cantidad"}
          >
            {item.quantity <= 1
              ? <Trash2 className="h-3.5 w-3.5" />
              : <Minus className="h-3.5 w-3.5" />
            }
          </button>

          <span className="text-sm font-black tabular-nums w-8 text-center text-foreground select-none border-x border-border/60 h-8 flex items-center justify-center">
            {item.quantity}
          </span>

          <button
            type="button"
            onClick={() => onUpdateQuantity(item.producto.id, +1)}
            disabled={item.quantity >= maxStock}
            className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors disabled:opacity-25 disabled:pointer-events-none"
            aria-label="Aumentar cantidad"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Subtotal — crece para ocupar el espacio del medio */}
        <div className="flex-1 flex flex-col items-end">
          <span className="font-black text-base text-primary tabular-nums leading-tight">
            {formatCurrency(subtotalNeto)}
          </span>
          {bestDiscountPct && (
            <span className="text-[10px] text-muted-foreground/40 line-through tabular-nums leading-tight">
              {formatCurrency(subtotalBruto)}
            </span>
          )}
        </div>

        {/* Eliminar explícito */}
        <div className="flex flex-col items-center shrink-0">
          <button
            type="button"
            onClick={() => onRemove(item.producto.id)}
            className="h-8 w-8 flex items-center justify-center rounded-xl border border-border/40 bg-muted/30 text-muted-foreground/40 hover:bg-[color:var(--status-danger)]/10 hover:text-[color:var(--status-danger)] hover:border-[color:var(--status-danger)]/30 transition-all"
            aria-label={`Eliminar ${item.producto.nombre}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {isLast && (
            <span className="hidden md:block text-[8px] font-black font-mono text-muted-foreground/30 tracking-tight select-none mt-0.5">
              Supr
            </span>
          )}
        </div>

      </div>
    </article>
  );
}
