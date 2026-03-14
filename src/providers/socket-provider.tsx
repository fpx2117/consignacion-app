/* eslint-disable */
// @ts-nocheck
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io as ClientIO, Socket } from "socket.io-client";
import { usePathname } from "next/navigation";

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const pathname = usePathname();

  // No intentar conectar en rutas públicas/sin sesión
  const isSocketDisabledRoute =
    pathname?.startsWith("/setup") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/forgot-password") ||
    pathname?.startsWith("/reset-password") ||
    pathname?.startsWith("/lista") ||
    pathname?.startsWith("/x/");

  useEffect(() => {
    let cancelled = false;

    if (!pathname) {
      return;
    }

    // 1. No conectar en rutas públicas
    if (isSocketDisabledRoute) {
      setSocket(null);
      setIsConnected(false);
      console.log(`⏭️ CLIENTE: Ruta pública detectada (${pathname}), socket omitido`);
      return;
    }

    const connectSocket = async () => {
      try {
        // 2. Forzar same-origin para usar la misma cookie HttpOnly de sesión.
        // Evita desalineación entre NEXT_PUBLIC_BASE_URL y el host real en navegador.
        const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";

        console.log("🔌 Intentando conectar Socket.IO (same-origin) a:", currentOrigin);

        // 3. Inicializar Socket
        const socketInstance = ClientIO({
          path: "/socket.io",
          addTrailingSlash: false,
          withCredentials: true,
          autoConnect: false,
          reconnection: true,
          reconnectionAttempts: 5,
          transports: ["polling", "websocket"],
        });

        socketInstance.on("connect", () => {
          console.log("🟢 CLIENTE: Socket Conectado. ID:", socketInstance.id);
          setIsConnected(true);
        });

        socketInstance.on("disconnect", (reason) => {
          console.log("🔴 CLIENTE: Socket Desconectado. Razón:", reason);
          setIsConnected(false);
        });

        socketInstance.on("connect_error", (err) => {
          const message = String(err?.message || "");
          const isAuthError =
            message.includes("Autenticación requerida") ||
            message.includes("Token inválido") ||
            message.includes("Token inválido o expirado");

          if (isAuthError) {
            if (!cancelled) {
              setSocket(null);
              setIsConnected(false);
            }
            socketInstance.disconnect();
            return;
          }

          console.error("⚠️ CLIENTE: Error de conexión:", message);
        });

        if (!cancelled) {
          setSocket(socketInstance);
          window.setTimeout(() => {
            if (!cancelled && !socketInstance.connected) {
              socketInstance.connect();
            }
          }, 120);
        } else {
          socketInstance.disconnect();
        }
      } catch (error) {
        if (!cancelled) {
          setSocket(null);
          setIsConnected(false);
          console.error("⚠️ CLIENTE: No se pudo validar sesión para socket", error);
        }
      }
    };

    void connectSocket();

    return () => {
      cancelled = true;
      setIsConnected(false);
      setSocket((prev) => {
        if (prev) {
          console.log("🛑 Limpiando instancia de socket...");
          prev.disconnect();
        }
        return null;
      });
    };
  }, [isSocketDisabledRoute, pathname]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
