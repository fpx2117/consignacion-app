import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";

// ✅ Puerto dinámico (Railway, Render, VPS)
const port = Number(process.env.PORT) || 3000;

// ✅ Host abierto (necesario en producción)
const hostname = "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {

  let io: Server;

  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "", true);
      const { pathname } = parsedUrl;

      // ✅ Dispatch API
      if (pathname === "/api/socket/dispatch" && req.method === "POST") {
        const buffers = [];

        for await (const chunk of req) {
          buffers.push(chunk);
        }

        try {
          const data = Buffer.concat(buffers).toString();
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

        return;
      }

      // ✅ Socket handshake bypass
      if (pathname?.startsWith("/socket.io")) {
        return;
      }

      // ✅ Next.js normal handler
      await handle(req, res, parsedUrl);

    } catch (err) {
      console.error("❌ Error crítico en server:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // ✅ Socket.IO Init
  io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log("🟢 Socket conectado:", socket.id);
  });

  httpServer.listen(port, () => {
    console.log(`🚀 Servidor listo en puerto ${port}`);
  });
});
