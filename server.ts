import "dotenv/config";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
// @ts-expect-error cookie viene como dep transitiva de socket.io/engine.io
import { parse as parseCookie } from "cookie";
import { jwtVerify } from "jose";
import { checkSessionValidity, prismaSessionLookup } from "./src/lib/auth/session-validity";
import {
  resolveNotificationRoom,
  resolveSocketRooms,
} from "./src/lib/notificaciones/socket-rooms";
import { resolveEffectiveSucursalContext } from "./src/lib/security/sucursalScope";
import { startMemoryLogger } from "./src/lib/observability/memory-logger";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;

// Secret para autenticar dispatch interno de notificaciones
const SOCKET_DISPATCH_SECRET =
  process.env.SOCKET_DISPATCH_SECRET || process.env.CRON_SECRET;

// JWT secret para autenticar conexiones Socket.IO
const JWT_SECRET_RAW = process.env.JWT_SECRET;
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || "access_token";

function looksLikeJwt(value: string | undefined) {
  if (!value) return false;
  return /^eyJ[\w-]*\.[\w-]*\.[\w-]*$/.test(value);
}

function extractJwtFromCookies(cookieHeader: string) {
  const cookies = parseCookie(cookieHeader || "");

  const candidates = [
    cookies[JWT_COOKIE_NAME],
    cookies.access_token,
    cookies.token,
    cookies.jwt,
    cookies.auth_token,
  ];

  const direct = candidates.find((candidate) => looksLikeJwt(candidate));
  if (direct) return direct;

  for (const value of Object.values(cookies) as Array<string | undefined>) {
    if (looksLikeJwt(value)) return value;
  }

  return null;
}

// 1. Extraer Hostname de la variable de entorno
let hostname = "localhost";
try {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    const urlObj = new URL(process.env.NEXT_PUBLIC_BASE_URL);
    hostname = urlObj.hostname;
  }
} catch {
  console.warn("⚠️ No se pudo parsear NEXT_PUBLIC_BASE_URL, usando localhost");
}

// Para escuchar en Docker/Railway/Render, se requiere 0.0.0.0
const listenHost = "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "", true);
      const { pathname } = parsedUrl;

      // 2. Evitar que Next.js maneje /socket.io
      if (pathname?.startsWith("/socket.io")) {
        return;
      }

      // 3. Dispatch API (notificaciones) — PROTEGIDO con shared secret
      if (pathname === "/api/socket/dispatch" && req.method === "POST") {
        // Verificar autenticación con shared secret
        const authHeader = req.headers["authorization"];
        if (
          !SOCKET_DISPATCH_SECRET ||
          authHeader !== `Bearer ${SOCKET_DISPATCH_SECRET}`
        ) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "No autorizado" }));
          return;
        }

        const buffers: Buffer[] = [];
        for await (const chunk of req) {
          buffers.push(chunk as Buffer);
        }

        try {
          const data = Buffer.concat(buffers).toString();
          if (!data) throw new Error("Body vacío");

          const json = JSON.parse(data);
          const { notification } = json;

          if (io && notification) {
            // ADR 005: destino mínimo. Una notificación de sucursal no puede
            // llegar a otra sucursal de la misma instalación.
            const room = resolveNotificationRoom(notification);
            console.log(
              "⚡ [Server] Despachando notificación:",
              notification.type,
              notification.title,
              "→",
              room,
            );
            io.to(room).emit("new-notification", notification);

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, emitted: true, room }));
          } else {
            console.warn(
              "⚠️ [Server] Fallo en dispatch: io o notification ausente",
              { hasIo: !!io, hasNotif: !!notification },
            );
            throw new Error("IO no inicializado o faltan datos");
          }
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : "Error desconocido";
          console.error("❌ Error Dispatch:", message);
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Error en dispatch" }));
        }
        return;
      }

      // 4. Next.js maneja el resto de rutas
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("❌ Error crítico en server:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // 5. Configurar CORS de Socket.IO — no usar wildcard
  const corsOrigin =
    process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!corsOrigin && !dev) {
    console.error(
      "⚠️ NEXT_PUBLIC_BASE_URL no está configurado. CORS de Socket.IO usará origen restrictivo.",
    );
  }

  const io = new Server(httpServer, {
    path: "/socket.io",
    addTrailingSlash: false,
    cors: {
      origin: corsOrigin || (dev ? "http://localhost:3000" : false),
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
  });

  // 6. Middleware de autenticación para conexiones Socket.IO
  //    Verifica la firma del JWT **y** que la sesión siga vigente en la base
  //    (ADR 005). Un token firmado con la sesión revocada no conecta.
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || "";
      const token = extractJwtFromCookies(cookieHeader);

      if (!token) {
        return next(new Error("Autenticación requerida"));
      }

      if (!JWT_SECRET_RAW) {
        return next(new Error("Configuración de servidor inválida"));
      }

      // `next/headers` no se puede importar en el servidor custom: se verifica la
      // firma con jose y la vigencia con la misma regla que el guard HTTP.
      const secret = new TextEncoder().encode(JWT_SECRET_RAW);
      const { payload } = await jwtVerify(token, secret);
      const user = payload as unknown as {
        sub: string;
        rol: "ADMIN" | "EMPLEADO";
        sucursalId: number | null;
      };

      const validity = await checkSessionValidity(token, prismaSessionLookup);
      if (validity !== "active") {
        return next(new Error("Sesión no vigente"));
      }

      const { prisma } = await import("./src/lib/prisma");
      const allowedSucursalIds =
        user.rol === "ADMIN"
          ? (
              await prisma.sucursal.findMany({
                where: { activa: true },
                select: { id: true },
              })
            ).map((sucursal) => sucursal.id)
          : typeof user.sucursalId === "number"
            ? (
                await prisma.sucursal.findFirst({
                  where: { id: user.sucursalId, activa: true },
                  select: { id: true },
                })
              )
              ? [user.sucursalId]
              : []
            : [];

      const cookies = parseCookie(cookieHeader);
      const context = resolveEffectiveSucursalContext({
        user,
        allowedSucursalIds,
        cookieSucursalId: cookies["active_sucursal_id"] ?? null,
        jwtSucursalId: user.sucursalId,
      });

      if (!context) {
        return next(new Error("Sucursal activa no autorizada"));
      }

      const userId = Number(user.sub);
      if (!Number.isInteger(userId) || userId <= 0) {
        return next(new Error("Identidad inválida"));
      }

      socket.data.userId = userId;
      // En una sucursal activa el socket escucha sólo esa; en vista global,
      // todas las que el rol tiene permitidas (un admin puede monitorear).
      socket.data.activeSucursalId = context.isGlobalView
        ? null
        : context.activeSucursalId;
      socket.data.visibleSucursalIds = allowedSucursalIds;
      next();
    } catch {
      next(new Error("Token inválido o expirado"));
    }
  });

  io.on("connection", (socket) => {
    const rooms = resolveSocketRooms({
      userId: socket.data.userId,
      activeSucursalId: socket.data.activeSucursalId,
      visibleSucursalIds: socket.data.visibleSucursalIds,
    });
    for (const room of rooms) socket.join(room);
    console.log(
      `🟢 Socket conectado (autenticado): ${socket.id} → ${rooms.join(", ")}`,
    );

    socket.on("disconnect", (reason) => {
      console.log(`🔴 Socket desconectado (${socket.id}): ${reason}`);
    });
  });

  // 7. Instrumentación de memoria (log periódico, ver src/lib/observability/memory-logger.ts).
  // Tesseract ya NO se precarga acá: se carga bajo demanda (lazy) la primera
  // vez que recognizeImage() lo necesita (ver tesseract-service.ts), para no
  // pagar ~500MB-1GB de RAM permanente en réplicas que nunca procesan OCR.
  startMemoryLogger();

  // 8. Escuchar en el puerto
  httpServer.listen(port, listenHost, () => {
    console.log(`> 🚀 Servidor listo en http://${listenHost}:${port}`);
    console.log(`> 🌐 Hostname configurado para Next.js: ${hostname}`);
  });

  // 9. Graceful shutdown
  const shutdown = async () => {
    console.log("\n🛑 Apagando servidor...");
    io?.close();
    httpServer.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
});
