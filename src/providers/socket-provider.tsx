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

  // No intentar conectar si estamos en el setup o login (no hay sesión)
  const isAuthPage = pathname?.startsWith("/setup") || pathname?.startsWith("/login") || pathname?.startsWith("/forgot-password") || pathname?.startsWith("/reset-password");

  useEffect(() => {
    // 1. No conectar si estamos en una página de autenticación
    if (isAuthPage) {
      console.log(`⏭️ CLIENTE: Ruta de auth detectada (${pathname}), socket omitido`);
      return;
    }

    // 2. Definir la URL correctamente.
    // En local, window.location.origin suele ser suficiente y maneja http/https automáticamente.
    const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");

    console.log("🔌 Intentando conectar Socket.IO a:", siteUrl);

    // 2. Inicializar Socket
    const socketInstance = ClientIO(siteUrl, {
      path: "/socket.io",
      addTrailingSlash: false,
      reconnection: true, // Habilitar reconexión explícita
      reconnectionAttempts: 5,
      transports: ["polling", "websocket"], // Polling primero mejora compatibilidad inicial
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
      console.error("⚠️ CLIENTE: Error de conexión:", err.message);
    });

    setSocket(socketInstance);

    // 3. Cleanup: Importante para no duplicar conexiones en React Strict Mode
    return () => {
      // Solo desconectar si el componente se desmonta realmente
      if (socketInstance.connected) {
        console.log("🛑 Limpiando instancia de socket...");
        socketInstance.disconnect();
      }
    };
  }, []); // Array vacío: Solo se ejecuta UNA VEZ al montar

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};