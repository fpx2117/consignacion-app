"use client";

import * as React from "react";
import type { CatalogCartItem, OnlineStoreSettings } from "@/lib/types";

type OrderSummaryProps = {
  cartItems: CatalogCartItem[];
  settings: OnlineStoreSettings;
  className?: string;
};

/**
 * Resumen de subtotal y total en el carrito.
 * Diseño limpio con separadores suaves y total en grande/negrita.
 */
export function OrderSummary({
  cartItems,
  settings,
  className = "",
}: OrderSummaryProps) {
  const template = settings.cart.messageTemplate;
  const totalItems = cartItems.reduce((acc, i) => acc + i.quantity, 0);

  const subtotal = cartItems.reduce(
    (acc, item) => acc + Number(item.precioVenta) * item.quantity,
    0
  );
  const total = subtotal;

  const fmt = (val: number) =>
    `$${val.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Subtotal */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-[var(--store-muted,#8A8F98)]">
          {template.subtotalLabel}
          <span className="ml-1 text-xs">({totalItems} {totalItems === 1 ? "producto" : "productos"})</span>
        </span>
        <span className="text-sm font-semibold text-[var(--store-text,#0F172A)]">
          {fmt(subtotal)}
        </span>
      </div>

      {/* Separador */}
      <div className="h-px bg-gray-100" />

      {/* Total grande */}
      <div className="flex justify-between items-center">
        <span className="text-base font-bold text-[var(--store-text,#0F172A)]">
          {template.totalLabel}
        </span>
        <span className="text-xl font-black text-[var(--store-text,#0F172A)]">
          {fmt(total)}
        </span>
      </div>
    </div>
  );
}
