"use client";

import { useEffect } from "react";
import { useSocket } from "@/providers/socket-provider";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import {
  NOTIFICATION_TYPE,
  NOTIFICATION_CONFIG,
} from "@/lib/notificaciones/types";

interface SocketNotificationPayload {
  type: NOTIFICATION_TYPE;
  title?: string;
  message?: string;
  data?: {
    ventaId?: string | number;
  };
}

export const SocketToaster = () => {
  const { socket } = useSocket();
  const pathname = usePathname();

  useEffect(() => {
    if (!socket) return;

    // No mostrar notificaciones del sistema en rutas públicas
    if (pathname.startsWith("/lista")) return;

    // Escuchar el evento genérico
    socket.on("new-notification", (data: SocketNotificationPayload) => {
      console.log("🔔 CLIENTE: Notificación recibida:", data.type, data.title);

      // 1. Si es una venta (NEW_ORDER), NO mostramos toast.
      // El usuario ya tiene el SuccessDialog en el POS y prefiere
      // que estas notificaciones solo lleguen al historial.
      if (data.type === NOTIFICATION_TYPE.NEW_ORDER) {
        return;
      }

      // Reproducir sonido
      const audio = new Audio("/sounds/notification.mp3");
      audio.play().catch(() => null);

      // Determinar configuración visual
      const type = data.type;
      const config =
        NOTIFICATION_CONFIG[type] ??
        NOTIFICATION_CONFIG[NOTIFICATION_TYPE.SYSTEM];

      // Icono: ShoppingBag sólo para NEW_ORDER (ya filtrado arriba — siempre BellRing aquí)
      const Icon = BellRing;

      // Mostrar Toast según severidad
      const toastFn =
        config.severity === "error"
          ? toast.error
          : config.severity === "warning"
            ? toast.warning
            : toast.message;

      toastFn(data.title ?? config.label, {
        icon: <Icon className="h-4 w-4" />,
        description: data.message,
        duration: 5000,
        action:
          data.data?.ventaId != null
            ? {
                label: "Ver Ticket",
                onClick: () =>
                  window.open(
                    `/ticket-loading/${data.data!.ventaId}`,
                    "_blank",
                  ),
              }
            : undefined,
      });
    });

    return () => {
      socket.off("new-notification");
    };
  }, [socket, pathname]);

  return null;
};
