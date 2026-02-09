import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "", true);
      const { pathname } = parsedUrl;

      // 1. SI ES EL DISPATCH (Tu API personalizada)
      if (pathname === "/api/socket/dispatch" && req.method === "POST") {
        const buffers = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        
        try {
          const data = Buffer.concat(buffers).toString();
          // Log para ver EXACTAMENTE qué llega
          console.log("📦 RAW Body recibido:", data); 

          if (!data) throw new Error("Body vacío");
          
          const json = JSON.parse(data);
          const { notification } = json;

          if (io && notification) {
            console.log("⚡ Emitiendo evento:", notification.title);
            io.emit("new-notification", notification);
            
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true }));
          } else {
            throw new Error("Faltan datos o IO no listo");
          }
        } catch (e: any) {
          console.error("❌ Error Dispatch:", e.message);
          res.statusCode = 400;
          res.end(JSON.stringify({ error: e.message }));
        }
        return; // IMPORTANTE: Terminar aquí
      }

      // 2. SI ES EL HANDSHAKE DE SOCKET.IO
      // (Evitamos que Next.js intente manejar esto y devuelva 404)
      if (pathname?.startsWith("/api/socket")) {
        // No hacemos NADA aquí. Dejamos que el listener de Socket.io (abajo)
        // maneje esta petición automáticamente.
        return;
      }

      // 3. PARA TODO LO DEMÁS (Páginas de Next.js, CSS, Imágenes)
      await handle(req, res, parsedUrl);

    } catch (err) {
      console.error("Error crítico en server:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Inicializamos Socket.io
 const io = new Server(httpServer, {
  path: "/socket.io",
  addTrailingSlash: false,
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"],
});

  io.on("connection", (socket) => {
    console.log("🟢 Socket conectado:", socket.id);
  });

  httpServer.listen(port, () => {
    console.log(`> Servidor listo en http://${hostname}:${port}`);
  });
});