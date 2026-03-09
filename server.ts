import "dotenv/config";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
// @ts-expect-error cookie viene como dep transitiva de socket.io/engine.io
import { parse as parseCookie } from "cookie";
import { jwtVerify } from "jose";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;

// Secret para autenticar dispatch interno de notificaciones
const SOCKET_DISPATCH_SECRET = process.env.SOCKET_DISPATCH_SECRET || process.env.CRON_SECRET;

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
        if (!SOCKET_DISPATCH_SECRET || authHeader !== `Bearer ${SOCKET_DISPATCH_SECRET}`) {
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
            console.log("⚡ [Server] Despachando notificación:", notification.type, notification.title);
            io.emit("new-notification", notification);

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, emitted: true }));
          } else {
            console.warn("⚠️ [Server] Fallo en dispatch: io o notification ausente", { hasIo: !!io, hasNotif: !!notification });
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
  const corsOrigin = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!corsOrigin && !dev) {
    console.error("⚠️ NEXT_PUBLIC_BASE_URL no está configurado. CORS de Socket.IO usará origen restrictivo.");
  }

  const io = new Server(httpServer, {
    path: "/socket.io",
    addTrailingSlash: false,
    cors: {
      origin: corsOrigin || (dev ? "http://localhost:3000" : false),
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["polling", "websocket"],
  });

  // 6. Middleware de autenticación para conexiones Socket.IO
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

      const secret = new TextEncoder().encode(JWT_SECRET_RAW);
      await jwtVerify(token, secret);
      next();
    } catch {
      next(new Error("Token inválido o expirado"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`🟢 Socket conectado (autenticado): ${socket.id}`);

    socket.on("disconnect", (reason) => {
      console.log(`🔴 Socket desconectado (${socket.id}): ${reason}`);
    });
  });

  // 7. Escuchar en el puerto
  httpServer.listen(port, listenHost, () => {
    console.log(`> 🚀 Servidor listo en http://${listenHost}:${port}`);
    console.log(`> 🌐 Hostname configurado para Next.js: ${hostname}`);
  });
});
