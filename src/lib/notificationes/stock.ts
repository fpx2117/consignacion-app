import { prisma } from "@/lib/prisma";

function getDispatchUrl() {
  if (process.env.SOCKET_DISPATCH_URL) return process.env.SOCKET_DISPATCH_URL;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/api/socket/dispatch`;
}

function nowTime() {
  return new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

async function dispatchSocket(notification: {
  id: string;
  title: string;
  description: string;
  type: "low_stock" | "out_of_stock" | "system";
  time: string;
  productoId?: number;
}) {
  const url = getDispatchUrl();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification }),
      cache: 'no-store'
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Error API Socket (${res.status}):`, errorText);
    }
  } catch (error) {
    console.error("❌ Error de red al enviar socket:", error);
  }
}

export async function notifyStockIfNeeded(productId: number, sucursalId: number = 1) {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id: productId },
      select: {
        id: true,
        nombre: true,
        stockDisponibleUnits: true,
        stockMinUnits: true,
      },
    });

    if (!producto) return;

    const stock = producto.stockDisponibleUnits;
    const min = producto.stockMinUnits ?? 0;

    // --- ESCENARIO 1: SIN STOCK (Prioridad Alta) ---
    if (stock <= 0) {
      const fingerprint = `OUT_OF_STOCK:PRODUCT:${producto.id}:SUC:${sucursalId}`;

      const n = await prisma.notification.upsert({
        where: { fingerprint },
        update: {
          read: false,
          updatedAt: new Date()
        },
        create: {
          type: "OUT_OF_STOCK",
          title: "Sin stock",
          description: `${producto.nombre} se quedó sin unidades.`,
          productoId: producto.id,
          sucursalId,
          read: false,
          fingerprint,
        },
      });

      if (min > 0) {
        await prisma.notification.updateMany({
          where: {
            fingerprint: `LOW_STOCK:PRODUCT:${producto.id}:MIN:${min}:SUC:${sucursalId}`,
            read: false
          },
          data: { read: true }
        });
      }

      await dispatchSocket({
        id: String(n.id),
        title: n.title,
        description: n.description,
        type: "out_of_stock",
        time: nowTime(),
        productoId: n.productoId ?? undefined,
      });

      return;
    }

    // --- ESCENARIO 2: STOCK BAJO ---
    if (min > 0 && stock <= min) {
      const fingerprint = `LOW_STOCK:PRODUCT:${producto.id}:MIN:${min}:SUC:${sucursalId}`;

      const n = await prisma.notification.upsert({
        where: { fingerprint },
        update: {
          read: false,
          updatedAt: new Date()
        },
        create: {
          type: "LOW_STOCK",
          title: "Stock bajo",
          description: `Quedan solo ${stock} unidades de ${producto.nombre}.`,
          productoId: producto.id,
          sucursalId,
          read: false,
          fingerprint,
        },
      });

      await dispatchSocket({
        id: String(n.id),
        title: n.title,
        description: n.description,
        type: "low_stock",
        time: nowTime(),
        productoId: n.productoId ?? undefined,
      });
    }

  } catch (err) {
    console.error("❌ Error CRÍTICO en notifyStockIfNeeded:", err);
  }
}