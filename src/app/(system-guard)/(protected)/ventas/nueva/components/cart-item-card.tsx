import { BadgePercent, Trash2 } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import type { CartItem } from "../types";
import { formatCurrency } from "../utils";

type CartItemCardProps = {
  item: CartItem;
  totalSubQty: number;
  bestDiscountPct: number | null;
  nextDiscountPct: number | null;
  nextDiscountQty: number | null;
  subcategoriaNombre: string;
  onRemove: (productId: number) => void;
};

export function CartItemCard({
  item,
  totalSubQty,
  bestDiscountPct,
  nextDiscountPct,
  nextDiscountQty,
  subcategoriaNombre,
  onRemove,
}: CartItemCardProps) {
  const subtotalBruto = Number(item.producto.precioVenta) * item.quantity;
  const subtotalNeto = bestDiscountPct ? subtotalBruto - subtotalBruto * (bestDiscountPct / 100) : subtotalBruto;

  return (
    <article className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/40 shadow-sm group">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center text-primary font-black text-xs shrink-0">
          {item.producto.imagenUrl ? (
            <Image
              src={item.producto.imagenUrl}
              alt={item.producto.nombre}
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="leading-none" aria-hidden="true">
              {item.quantity}x
            </span>
          )}
        </div>

        <div className="min-w-0 pr-2">
          <p className="font-bold text-sm truncate text-foreground">{item.producto.nombre}</p>
          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
            {formatCurrency(item.producto.precioVenta)} / unidad
          </p>

          {bestDiscountPct && (
            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600">
              <BadgePercent className="h-3 w-3" aria-hidden="true" />
              {`-${bestDiscountPct}% (${totalSubQty} de ${subcategoriaNombre})`}
            </div>
          )}

          {!bestDiscountPct && nextDiscountPct && nextDiscountQty && (
            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-muted-foreground/60">
              <BadgePercent className="h-3 w-3" aria-hidden="true" />
              {`-${nextDiscountPct}% llevando ${nextDiscountQty}+ de ${subcategoriaNombre}`}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="font-black text-base text-primary">{formatCurrency(subtotalNeto)}</span>
        {bestDiscountPct && (
          <span className="text-[10px] text-muted-foreground line-through opacity-60 font-medium">
            {formatCurrency(subtotalBruto)}
          </span>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground/30 hover:text-red-500 rounded-lg transition-colors mt-1 focus-visible:ring-2"
          onClick={() => onRemove(item.producto.id)}
          aria-label={`Quitar ${item.producto.nombre} del carrito`}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}
