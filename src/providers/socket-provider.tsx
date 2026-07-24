"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
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

const DISABLED_ROUTES = [
  "/setup",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/lista",
  "/x/",
];

function isPublicRoute(path: string | null): boolean {
  if (!path) return false;
  return DISABLED_ROUTES.some((r) => path.startsWith(r));
}

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const initialPathnameRef = useRef(pathname);
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // ✅ Efecto de conexión: se ejecuta UNA vez al montar.
  // No depende de pathname — el socket persiste entre navegaciones.
  useEffect(() => {
    // No conectar si la ruta inicial ya es pública
    if (isPublicRoute(initialPathnameRef.current)) return;

    let cancelled = false;

    const connectSocket = async () => {
      try {
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
          if (!cancelled) setIsConnected(true);
        });

        socketInstance.on("disconnect", () => {
          if (!cancelled) setIsConnected(false);
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
          socketRef.current = socketInstance;
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
          console.error(
            "⚠️ CLIENTE: No se pudo validar sesión para socket",
            error,
          );
        }
      }
    };

    void connectSocket();

    return () => {
      cancelled = true;
      setIsConnected(false);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
    };
  }, []); // ✅ Sin reconectar en cada navegación

  // ✅ Efecto de guarda de ruta: observa pathname pero SOLO desconecta.
  // No reconecta — el provider se desmontará si el usuario navega a /login.
  useEffect(() => {
    if (isPublicRoute(pathname) && socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  }, [pathname]);

  const isDisabled = isPublicRoute(pathname);

  return (
    <SocketContext.Provider
      value={{
        socket: isDisabled ? null : socket,
        isConnected: isDisabled ? false : isConnected,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
