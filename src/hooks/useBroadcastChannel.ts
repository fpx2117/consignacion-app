"use client";

import { useEffect } from "react";
import {
  subscribeAppMessages,
  type BroadcastMessage,
} from "@/lib/broadcast-channel";

type MessageHandler = {
  [K in BroadcastMessage["type"]]?: (
    message: Extract<BroadcastMessage, { type: K }>
  ) => void;
};

/**
 * Hook para escuchar mensajes del BroadcastChannel de la app.
 * Acepta un objeto de handlers por tipo de mensaje.
 * Se suscribe en mount y limpia en unmount.
 *
 * @example
 * useBroadcastChannel({
 *   "sucursal-changed": (msg) => { console.log(msg.sucursalId) },
 *   "plan-changed": () => { router.refresh() },
 * });
 */
export function useBroadcastChannel(handlers: MessageHandler): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const unsubscribe = subscribeAppMessages((message) => {
      const handler = handlers[message.type] as
        | ((msg: BroadcastMessage) => void)
        | undefined;
      if (handler) {
        handler(message);
      }
    });

    return unsubscribe;
    // handlers cambia en cada render, pero la suscripción se usa como callback
    // estable internamente. Re-suscribirse en cada render está bien dado que
    // es solo un addEventListener/removeEventListener ligero.
  });
}
