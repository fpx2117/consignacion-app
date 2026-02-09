"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io as ClientIO, Socket } from "socket.io-client";

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (socket) return;

    // FORZAMOS LA URL EN DESARROLLO
    // Esto asegura que se conecte al Custom Server en el puerto 3000
 const siteUrl = typeof window !== "undefined" ? window.location.origin : "";


    const socketInstance = new (ClientIO as any)(siteUrl, {
  path: "/socket.io",
  addTrailingSlash: false,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  autoConnect: true,
  transports: ["polling", "websocket"],
});

    socketInstance.on("connect", () => {
      console.log("🟢 Socket Conectado (ID):", socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      console.log("🔴 Socket Desconectado");
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (err: any) => {
      // Ignoramos errores de conexión iniciales mientras levanta el server
      console.warn("⚠️ Reconectando socket...", err.message);
    });

    setSocket(socketInstance);

    // ❌ ELIMINADO: Ya no necesitamos hacer fetch("/api/socket") 
    // porque el Custom Server inicia el socket automáticamente.

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};