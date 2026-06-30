"use client";

import * as React from "react";
import { Receipt, Scissors } from "lucide-react";
import type { CatalogCartItem, OnlineStoreSettings } from "@/lib/types";

type CheckoutTicketPreviewProps = {
  settings: OnlineStoreSettings;
  cartItems: CatalogCartItem[];
  subtotal: string;
  total: string;
  className?: string;
};

export function CheckoutTicketPreview({
  settings,
  cartItems,
  subtotal,
  total,
  className = "",
}: CheckoutTicketPreviewProps) {
  const storeName = settings.storeName || "Tienda";
  const ticketSeed = React.useMemo(
    () => cartItems.map((item) => `${item.id}-${item.quantity}`).join("-") || "000000",
    [cartItems],
  );
  const ticketId = `PRE-${ticketSeed.slice(0, 12).replace(/[^a-zA-Z0-9]/g, "").toUpperCase().padEnd(6, "0")}`;
  const now = React.useMemo(
    () => new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date()),
    [],
  );

  return (
    <div className={`rounded-[28px] border border-stone-200 bg-stone-50 p-3 shadow-sm ${className}`}>
      <div className="overflow-hidden rounded-3xl border border-dashed border-stone-300 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
        <div className="border-b border-dashed border-stone-200 px-4 py-4 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--store-primary,#007AFF)]/10 text-[var(--store-primary,#007AFF)]">
            <Receipt className="h-5 w-5" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-stone-400">Ticket de compra</p>
          <h4 className="mt-1 text-lg font-black text-stone-900">{storeName}</h4>
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-stone-500">
            <span>{ticketId}</span>
            <span className="h-1 w-1 rounded-full bg-stone-300" />
            <span>{now}</span>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4">
          {cartItems.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-stone-800">{item.nombre}</p>
                <p className="text-xs text-stone-500">{item.quantity} u.</p>
              </div>
              <span className="shrink-0 font-semibold text-stone-700">
                ${(Number(item.precioVenta) * item.quantity).toLocaleString("es-AR")}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center border-y border-dashed border-stone-200 py-2 text-stone-300">
          <Scissors className="h-4 w-4" />
        </div>

        <div className="space-y-2 px-4 py-4">
          <div className="flex items-center justify-between text-sm text-stone-500">
            <span>Subtotal</span>
            <span>{subtotal}</span>
          </div>
          <div className="flex items-center justify-between text-base font-black text-stone-900">
            <span>Total estimado</span>
            <span>{total}</span>
          </div>
          <p className="pt-1 text-center text-[11px] uppercase tracking-[0.24em] text-stone-400">
            Pago online seguro
          </p>
        </div>
      </div>
    </div>
  );
}
