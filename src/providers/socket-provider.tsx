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

export const useSocket = () => useContext(SocketContext);

function normalizeUrl(raw?: string) {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (socket) return;

    const envUrl = normalizeUrl(process.env.NEXT_PUBLIC_BASE_URL);
    const fallback = typeof window !== "undefined" ? window.location.origin : "";
    const siteUrl = envUrl || fallback;

    const socketInstance = (ClientIO as any)(siteUrl, {
      path: "/socket.io",
      addTrailingSlash: false,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      autoConnect: true,
      transports: ["polling", "websocket"],
      // Si tu auth depende de cookie en otro dominio, esto ayuda:
      withCredentials: true,
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
      console.warn("⚠️ Error socket / reconectando:", err?.message || err);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
