import { prisma } from "@/lib/prisma";

function nowTime() {
  return new Date().toLocaleTimeString();
}

function dispatchUrl() {
  // Para SSR/Node: usar URL absoluta
  return process.env.SOCKET_DISPATCH_URL || "http://localhost:3000/api/socket/dispatch";
}

async function dispatchSocket(notification: any) {
  await fetch(dispatchUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notification }),
  });
}

export async function notifyStockIfNeeded(productId: number) {
  const producto = await prisma.producto.findUnique({
    where: { id: productId },
    select: {
      id: true,
      nombre: true,
      stockDisponibleUnits: true,
      // si agregaste stockMinUnits, úsalo:
      stockMinUnits: true,
    },
  });

  if (!producto) return;

  // OUT OF STOCK
  if (producto.stockDisponibleUnits <= 0) {
    const fingerprint = `OUT_OF_STOCK:PRODUCT:${producto.id}`;

    const n = await prisma.notification.upsert({
      where: { fingerprint },
      update: { read: false }, // revive si estaba leída
      create: {
        type: "OUT_OF_STOCK",
        title: "Sin stock",
        description: `${producto.nombre} quedó sin stock.`,
        productoId: producto.id,
        read: false,
        fingerprint,
      },
    });

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

  // LOW STOCK (si tenés stockMinUnits y está habilitado)
  const min = producto.stockMinUnits ?? 0;
  if (min > 0 && producto.stockDisponibleUnits <= min) {
    const fingerprint = `LOW_STOCK:PRODUCT:${producto.id}:MIN:${min}`;

    const n = await prisma.notification.upsert({
      where: { fingerprint },
      update: { read: false },
      create: {
        type: "LOW_STOCK",
        title: "Stock bajo",
        description: `${producto.nombre} está bajo en stock (${producto.stockDisponibleUnits}u).`,
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
}
