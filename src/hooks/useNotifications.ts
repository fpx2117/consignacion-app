"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSocket } from "@/providers/socket-provider";
import { apiService } from "@/lib/apiService";
import type { AppNotification, DbNotification } from "@/types/notification";
import { mapDbNotificationToApp } from "@/types/notification";

type UseNotificationsOptions = {
  onlyUnreadOnLoad?: boolean; // default true
  limit?: number; // default 50
};

export const useNotifications = (options?: UseNotificationsOptions) => {
  const { socket, isConnected } = useSocket();

  const onlyUnreadOnLoad = options?.onlyUnreadOnLoad ?? true;
  const limit = options?.limit ?? 50;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [loading, setLoading] = useState(false);

  // dedupe por id
  const idsSetRef = useRef<Set<string>>(new Set());

  const addNotification = useCallback((n: AppNotification) => {
    if (!n?.id) return;

    if (idsSetRef.current.has(n.id)) return;

    idsSetRef.current.add(n.id);
    setNotifications((prev) => [n, ...prev]);
    setHasUnread(true);
  }, []);

  /* =========================
     Carga inicial desde DB
  ========================= */
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        const res = await apiService.getNotificaciones({
          onlyUnread: onlyUnreadOnLoad,
          limit,
        });

        const dbList = (res.data ?? []) as DbNotification[];
        const mapped = dbList.map(mapDbNotificationToApp);

        if (!mounted) return;

        // Reset dedupe
        const newSet = new Set<string>();
        for (const n of mapped) newSet.add(n.id);
        idsSetRef.current = newSet;

        setNotifications(mapped);

        // Si pedís onlyUnread, entonces si hay items => hay unread
        // Si pedís historial (onlyUnread=false), el badge se maneja con eventos nuevos
        setHasUnread(onlyUnreadOnLoad ? mapped.length > 0 : false);
      } catch (e) {
        console.warn("Error loading notifications:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [onlyUnreadOnLoad, limit]);

  /* =========================
     Socket listener (en vivo)
  ========================= */
  useEffect(() => {
    if (!socket || !isConnected) return;

    const onNewNotification = (data: AppNotification) => {
      if (!data?.id || !data?.title) return;
      addNotification(data);
    };

    socket.off("new-notification", onNewNotification);
    socket.on("new-notification", onNewNotification);

    return () => {
      socket.off("new-notification", onNewNotification);
    };
  }, [socket, isConnected, addNotification]);

  /* =========================
     Acciones
  ========================= */
 const markAsRead = useCallback(async () => {
  try {
    await apiService.marcarTodasNotificacionesLeidas();

    // ✅ Apaga badge
    setHasUnread(false);

    // ✅ Como el panel es SOLO no leídas, al leerlas se vacía
    setNotifications([]);
    idsSetRef.current = new Set();
  } catch (e) {
    console.warn("Error marking notifications as read:", e);
  }
}, []);

  const unreadCount = useMemo(() => {
    // MVP: si hay unread, contamos lo que mostramos
    return hasUnread ? notifications.length : 0;
  }, [hasUnread, notifications.length]);

  return {
    notifications,
    hasUnread,
    unreadCount,
    markAsRead,
    isConnected,
    loading,
  };
};
