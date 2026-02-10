"use client";

import { useEffect } from "react";
import { useSocket } from "@/providers/socket-provider"; // Tu provider anterior
import { toast } from "sonner"; // O tu librería de toast favorita
import { NOTIFICATION_TYPE, NOTIFICATION_CONFIG } from "@/lib/notificationes/notificaciones-types"; // Configuración de notificaciones

export const SocketToaster = () => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    // Escuchar el evento genérico
    socket.on("new-notification", (data: any) => {
      
      // Reproducir sonido (opcional)
      const audio = new Audio("/sounds/notification.mp3"); 
      audio.play().catch(() => null); // Ignorar error si el navegador bloquea autoplay

      // Determinar configuración visual
      const type = data.type as NOTIFICATION_TYPE;
      const config = NOTIFICATION_CONFIG[type] || NOTIFICATION_CONFIG[NOTIFICATION_TYPE.SYSTEM];

      // Mostrar Toast
      // Nota: Si usas 'sonner', puedes personalizar colores así:
      toast[config.severity === "error" ? "error" : config.severity === "warning" ? "warning" : "message"](
        data.title || config.label,
        {
          description: data.message,
          duration: 5000, // 5 segundos
          action: {
            label: "Ver",
            onClick: () => console.log("Ir a producto", data.data?.productId),
          },
        }
      );
    });

    return () => {
      socket.off("new-notification");
    };
  }, [socket]);

  return null; // Este componente no renderiza nada visualmente, solo escucha
};