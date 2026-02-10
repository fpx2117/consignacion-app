import { prisma } from "@/lib/prisma";

/**
 * 1. URL ROBUSTA:
 * Necesitamos asegurar que la URL sea accesible desde el servidor.
 * En Vercel/Producción, localhost no suele funcionar para llamadas internas.
 */
function getDispatchUrl() {
  if (process.env.SOCKET_DISPATCH_URL) return process.env.SOCKET_DISPATCH_URL;
  
  // Usamos la variable pública de Vercel o localhost como fallback
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/api/socket/dispatch`;
}

function nowTime() {
  // Aseguramos formato consistente
  return new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * 2. DISPATCH SEGURO:
 * Agregamos try/catch y logs para saber si el error es de red o del socket.
 */
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
    // console.log(`📡 Intentando enviar socket a: ${url}`, notification); // Descomentar para debug agresivo

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification }),
      cache: 'no-store' // Importante para evitar cacheo en fetch de servidor
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Error API Socket (${res.status}):`, errorText);
    } 
  } catch (error) {
    console.error("❌ Error de red al enviar socket:", error);
    // No lanzamos error (throw) para que la venta no se cancele si falla la notificación
  }
}

export async function notifyStockIfNeeded(productId: number) {
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
      const fingerprint = `OUT_OF_STOCK:PRODUCT:${producto.id}`;

      // Actualizamos o creamos la notificación en DB
      const n = await prisma.notification.upsert({
        where: { fingerprint },
        update: { 
          read: false, 
          updatedAt: new Date() // Forzamos actualización de fecha
        }, 
        create: {
          type: "OUT_OF_STOCK", // Enum de Prisma (Mayúsculas)
          title: "Sin stock",
          description: `${producto.nombre} se quedó sin unidades.`,
          productoId: producto.id,
          read: false,
          fingerprint,
        },
      });

      // Limpieza: Si ya no hay stock, marcamos como leída cualquier alerta vieja de "stock bajo"
      // para que no aparezcan las dos juntas.
      if (min > 0) {
          await prisma.notification.updateMany({
              where: {
                  fingerprint: `LOW_STOCK:PRODUCT:${producto.id}:MIN:${min}`,
                  read: false
              },
              data: { read: true }
          });
      }

      // Enviamos al Socket (minúsculas para el frontend)
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
      const fingerprint = `LOW_STOCK:PRODUCT:${producto.id}:MIN:${min}`;

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