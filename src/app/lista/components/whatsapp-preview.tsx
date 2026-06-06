"use client";

import * as React from "react";
import type { OnlineStoreSettings, CatalogCartItem } from "@/lib/types";

type WhatsAppPreviewProps = {
  settings: OnlineStoreSettings;
  cartItems: CatalogCartItem[];
  subtotal: string;
  total: string;
  className?: string;
};

/**
 * Card que simula visualmente un mensaje de WhatsApp con el pedido.
 * Encabezado verde oscuro con nombre del comercio + "en línea".
 * Burbuja de mensaje clara con los productos, subtotal y total.
 * Diseño fiel a la referencia visual de la app.
 */
export function WhatsAppPreview({
  settings,
  cartItems,
  subtotal,
  total,
  className = "",
}: WhatsAppPreviewProps) {
  const template = settings.cart.messageTemplate;
  const storeName = settings.storeName || "Tienda";
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm ${className}`}>
      {/* Encabezado estilo WhatsApp */}
      <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#128C7E] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {storeName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{storeName}</p>
          <p className="text-emerald-300 text-xs">en línea</p>
        </div>
        {/* Íconos decorativos estilo WhatsApp */}
        <div className="flex items-center gap-3 text-white/60">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.1 1.18 2 2 0 012.1 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.45-.45a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
          </svg>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
          </svg>
        </div>
      </div>

      {/* Área del chat */}
      <div
        className="p-3 min-h-[100px]"
        style={{
          background: "linear-gradient(180deg, #E5DDD5 0%, #DDD5CB 100%)",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {/* Burbuja del mensaje */}
        <div className="max-w-[85%] bg-white rounded-xl rounded-tl-sm p-3 shadow-sm space-y-1.5">
          {/* Saludo */}
          <p className="text-sm font-medium text-[#075E54]">
            {template.greeting} {storeName} 👋
          </p>
          <p className="text-sm text-gray-700">{template.intro}</p>

          {/* Separador */}
          <div className="h-px bg-gray-100 my-1" />

          {/* Lista de productos */}
          <div className="space-y-0.5">
            {cartItems.map((item) => (
              <div key={item.id} className="flex justify-between text-xs text-gray-600 gap-2">
                <span className="truncate">
                  • {item.nombre} <span className="font-bold">x{item.quantity}</span>
                </span>
                <span className="flex-shrink-0 font-medium">
                  ${(Number(item.precioVenta) * item.quantity).toLocaleString("es-AR")}
                </span>
              </div>
            ))}
          </div>

          {/* Separador */}
          <div className="h-px bg-gray-100 my-1" />

          {/* Subtotal */}
          <div className="flex justify-between text-xs text-gray-500">
            <span>{template.subtotalLabel}:</span>
            <span>{subtotal}</span>
          </div>

          {/* Total */}
          <div className="flex justify-between text-sm font-bold text-[#075E54]">
            <span>{template.totalLabel}:</span>
            <span>{total}</span>
          </div>

          {/* Footer opcional */}
          {template.footer && (
            <p className="text-xs text-gray-400 italic mt-1">{template.footer}</p>
          )}

          {/* Timestamp estilo WhatsApp */}
          <div className="flex justify-end items-center gap-1 mt-1">
            <span className="text-[10px] text-gray-400">{timeStr}</span>
            <svg className="h-3 w-3 text-[#4FC3F7]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
