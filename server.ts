import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;

// ✅ 1. Extraer Hostname de la variable de entorno
// Esto asegura que coincida con tu .env (NEXT_PUBLIC_BASE_URL)
let hostname = "localhost";
try {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    const urlObj = new URL(process.env.NEXT_PUBLIC_BASE_URL);
    hostname = urlObj.hostname; // Devuelve 'localhost' o 'miweb.com'
  }
} catch (e) {
  console.warn("⚠️ No se pudo parsear NEXT_PUBLIC_BASE_URL, usando localhost");
}

// Nota: Para escuchar en Docker/Railway/Render, a veces se requiere 0.0.0.0 explícito
// aunque el hostname de Next.js sea el dominio.
const listenHost = "0.0.0.0"; 

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "", true);
      const { pathname } = parsedUrl;

      // ✅ 2. Evitar que Next.js maneje /socket.io (Solución del 404)
      if (pathname?.startsWith("/socket.io")) {
        // Al hacer return aquí sin enviar respuesta, permitimos que
        // el listener interno de Socket.IO capture la petición.
        return;
      }

      // ✅ 3. Dispatch API (Tu lógica para notificaciones)
      if (pathname === "/api/socket/dispatch" && req.method === "POST") {
        const buffers = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        
        try {
          const data = Buffer.concat(buffers).toString();
          if (!data) throw new Error("Body vacío");

          const json = JSON.parse(data);
          const { notification } = json;

          if (io && notification) {
            console.log("⚡ Emitiendo a clientes:", notification.title);
            io.emit("new-notification", notification);
            
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true }));
          } else {
            throw new Error("IO no inicializado o faltan datos");
          }
        } catch (e: any) {
          console.error("❌ Error Dispatch:", e.message);
          res.statusCode = 400;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      // ✅ 4. Next.js maneja el resto de rutas (páginas, api routes de next, etc)
      await handle(req, res, parsedUrl);

    } catch (err) {
      console.error("❌ Error crítico en server:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // ✅ 5. Inicializar Socket.IO
  const io = new Server(httpServer, {
    path: "/socket.io",
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXT_PUBLIC_BASE_URL || "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["polling", "websocket"], 
  });

  io.on("connection", (socket) => {
    console.log(`🟢 Socket conectado: ${socket.id}`);
    
    socket.on("disconnect", (reason) => {
      console.log(`🔴 Socket desconectado (${socket.id}): ${reason}`);
    });
  });

  // ✅ 6. Escuchar en el puerto
  httpServer.listen(port, listenHost, () => {
    console.log(`> 🚀 Servidor listo en http://${listenHost}:${port}`);
    console.log(`> 🌐 Hostname configurado para Next.js: ${hostname}`);
  });
});