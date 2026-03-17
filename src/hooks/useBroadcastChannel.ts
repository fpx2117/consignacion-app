"use client";

import { useEffect, useRef } from "react";
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
  // Capturamos handlers en un ref para que el efecto nunca necesite re-ejecutarse
  // pero siempre invoque la versión más reciente del handler.
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const unsubscribe = subscribeAppMessages((message) => {
      const handler = handlersRef.current[message.type] as
        | ((msg: BroadcastMessage) => void)
        | undefined;
      if (handler) {
        handler(message);
      }
    });

    return unsubscribe;
    // ✅ Array vacío → suscripción única por ciclo de vida del componente
  }, []);
}
