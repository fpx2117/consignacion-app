"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSocket } from "@/providers/socket-provider"; // Ajusta la ruta a tu provider
import { toast } from "sonner"; // Opcional, si quieres feedback visual

// 1. Definimos el tipo exacto que viene de Prisma/API
export interface AppNotification {
  id: number;
  type: "LOW_STOCK" | "OUT_OF_STOCK" | "EXPIRATION_NEAR" | "PRODUCT_EXPIRED" | "SYSTEM";
  title: string;
  description: string;
  read: boolean;
  createdAt: string; // Desde la API las fechas vienen como string ISO
  producto?: {
    id: number;
    nombre: string;
  };
}

interface UseNotificationsProps {
  limit?: number;
  onlyUnreadOnLoad?: boolean;
}

export function useNotifications({ limit = 50, onlyUnreadOnLoad = false }: UseNotificationsProps = {}) {
  const { socket, isConnected } = useSocket();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // --- A. Cargar notificaciones iniciales (Fetch API) con Deduplicación ---
  const lastFetchRef = useRef<number>(0);

  const fetchNotifications = useCallback(async () => {
    // Evitar múltiples llamadas en menos de 2 segundos (deduplicación básica)
    const now = Date.now();
    if (now - lastFetchRef.current < 2000) return;
    lastFetchRef.current = now;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: limit.toString(),
        onlyUnread: onlyUnreadOnLoad ? "true" : "false",
      });

      const res = await fetch(`/api/notificaciones?${params}`);
      const data = await res.json();

      if (data.data) {
        setNotifications(data.data);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error cargando notificaciones:", error);
    } finally {
      setLoading(false);
    }
  }, [limit, onlyUnreadOnLoad]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // --- B. Escuchar nuevos eventos del Socket ---
  useEffect(() => {
    if (!socket) return;

    socket.on("new-notification", (newNotif: any) => {
      // 1. Agregamos la nueva al principio de la lista
      setNotifications((prev) => {
        // Evitamos duplicados visuales si el socket manda lo mismo rápido
        const exists = prev.find((n) => n.id === newNotif.id);
        if (exists) return prev;

        // Formateamos para que coincida con la interfaz AppNotification
        const formatted: AppNotification = {
          id: Number(newNotif.id) || Date.now(), // Fallback por si no viene ID
          type: newNotif.type,
          title: newNotif.title,
          description: newNotif.message || newNotif.description, // Adaptar según qué mande tu backend
          read: false,
          createdAt: new Date().toISOString(),
          producto: newNotif.data ? { id: newNotif.data.productId, nombre: "..." } : undefined
        };

        return [formatted, ...prev];
      });

      // 2. Incrementamos contador
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.off("new-notification");
    };
  }, [socket]);

  // --- C. Función para Marcar Todo como Leído ---
  const markAllAsRead = async () => {
    try {
      // Optimistic Update (Actualizamos visualmente antes de que responda el server)
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

      // Llamada a la API
      await fetch("/api/notificaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });

      toast.success("Notificaciones marcadas como leídas");

    } catch (error) {
      console.error("Error marcando como leídas:", error);
      // Revertir si falla (opcional)
      fetchNotifications();
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    isConnected,
    markAllAsRead, // 👈 ¡Aquí está la función que te faltaba!
    hasUnread: unreadCount > 0,
    refresh: fetchNotifications,
  };
}