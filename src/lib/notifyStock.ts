/* eslint-disable */
// @ts-nocheck
import { prisma } from "@/lib/prisma";

// URL absoluta para SSR (tu apiRequest ya hace algo similar)
function getDispatchUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  return `${baseUrl}/api/socket/dispatch`;
}

async function dispatchSocket(notification: any) {
  try {
    await fetch(getDispatchUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification }),
    });
  } catch (e) {
    console.warn("Socket dispatch failed:", e);
  }
}

export async function notifyStockIfNeeded(productId: number) {
  const p = await prisma.producto.findUnique({
    where: { id: productId },
    select: {
      id: true,
      nombre: true,
      stockDisponibleUnits: true,
      // Si NO tenés este campo, borrá esta línea y el bloque LOW_STOCK
      stockMinUnits: true,
    },
  });

  if (!p) return;

  const time = new Date().toLocaleTimeString();

  // 1) OUT OF STOCK
  if (p.stockDisponibleUnits <= 0) {
    const fingerprint = `OUT_OF_STOCK:PRODUCT:${p.id}`;

    const n = await prisma.notification.upsert({
      where: { fingerprint },
      update: { read: false }, // si estaba leída, la reactivamos
      create: {
        type: "OUT_OF_STOCK",
        title: "Sin stock",
        description: `${p.nombre} quedó sin stock.`,
        productoId: p.id,
        read: false,
        fingerprint,
      },
    });

    await dispatchSocket({
      id: String(n.id),
      title: n.title,
      description: n.description,
      type: "out_of_stock",
      time,
      productoId: n.productoId ?? undefined,
    });

    return;
  }

  // 2) LOW STOCK (solo si existe stockMinUnits y está habilitado)
  const min = p.stockMinUnits ?? 0;
  if (min > 0 && p.stockDisponibleUnits <= min) {
    const fingerprint = `LOW_STOCK:PRODUCT:${p.id}:MIN:${min}`;

    const n = await prisma.notification.upsert({
      where: { fingerprint },
      update: { read: false },
      create: {
        type: "LOW_STOCK",
        title: "Stock bajo",
        description: `${p.nombre} está bajo en stock (${p.stockDisponibleUnits}u).`,
        productoId: p.id,
        read: false,
        fingerprint,
      },
    });

    await dispatchSocket({
      id: String(n.id),
      title: n.title,
      description: n.description,
      type: "low_stock",
      time,
      productoId: n.productoId ?? undefined,
    });
  }
}
