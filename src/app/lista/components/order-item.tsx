"use client";

import * as React from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { CatalogCartItem } from "@/lib/types";

type OrderItemProps = {
  item: CatalogCartItem;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
  showImage?: boolean;
  className?: string;
};

/**
 * Item individual en el carrito con selector de cantidad tipo pill azul.
 * Miniatura de imagen, nombre, selector −/+, precio alineado a la derecha.
 * Diseño fiel a la referencia visual (carrito tipo WhatsApp).
 */
export function OrderItem({
  item,
  onUpdateQuantity,
  onRemove,
  showImage = true,
  className = "",
}: OrderItemProps) {
  const price = Number(item.precioVenta);
  const lineTotal = price * item.quantity;

  return (
    <div className={`flex items-center gap-3 py-3.5 ${className}`}>
      {/* Miniatura */}
      {showImage && (
        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
          {item.imagenUrl ? (
            <img
              src={item.imagenUrl}
              alt={item.nombre}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-[9px] text-center leading-tight px-1">
              {item.nombre.slice(0, 8)}
            </div>
          )}
        </div>
      )}

      {/* Nombre + selector de cantidad */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--store-text,#0F172A)] line-clamp-1 leading-snug">
          {item.nombre}
        </p>

        {/* Selector pill estilo referencia visual */}
        <div className="flex items-center gap-2 mt-2">
          <div
            className="flex items-center rounded-full px-1 py-1 gap-1"
            style={{ backgroundColor: "var(--store-primary,#007AFF)" }}
          >
            <button
              onClick={() =>
                item.quantity <= 1
                  ? onRemove(item.id)
                  : onUpdateQuantity(item.id, item.quantity - 1)
              }
              className="w-7 h-7 flex items-center justify-center text-white rounded-full hover:bg-white/20 active:scale-90 transition-all"
              aria-label="Reducir cantidad"
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>

            <span className="w-7 text-center text-sm font-bold text-white select-none">
              {item.quantity}
            </span>

            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              className="w-7 h-7 flex items-center justify-center text-white rounded-full hover:bg-white/20 active:scale-90 transition-all"
              aria-label="Aumentar cantidad"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>

          {/* Botón eliminar sutil */}
          <button
            onClick={() => onRemove(item.id)}
            className="h-7 w-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"
            aria-label="Eliminar producto"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Precio total de línea */}
      <div className="text-right flex-shrink-0 pl-1">
        <p className="text-sm font-bold text-[var(--store-text,#0F172A)]">
          ${lineTotal.toLocaleString("es-AR", { minimumFractionDigits: 0 })}
        </p>
        {item.quantity > 1 && (
          <p className="text-[11px] text-[var(--store-muted,#8A8F98)]">
            ${price.toLocaleString("es-AR")} c/u
          </p>
        )}
      </div>
    </div>
  );
}
