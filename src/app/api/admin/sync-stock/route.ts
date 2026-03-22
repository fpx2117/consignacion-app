// src/app/api/admin/sync-stock/route.ts
// POST: Recalcula Producto.stockDisponibleUnits y stockConsignadoUnits
// sumando los valores reales de StockSucursal.
// Uso único para reparar registros desincronizados por el bug de pedidos-esperados/liquidaciones.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";

export async function POST() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "Se requiere rol ADMIN" }, { status: 403 });
  }

  try {
    // Traer todos los productos con sus stockSucursal
    const productos = await prisma.producto.findMany({
      select: {
        id: true,
        stockDisponibleUnits: true,
        stockConsignadoUnits: true,
        stockSucursals: {
          select: {
            stockDisponibleUnits: true,
            stockConsignadoUnits: true,
          },
        },
      },
    });

    let actualizados = 0;
    let sinCambios = 0;

    for (const producto of productos) {
      const disponibleReal = producto.stockSucursals.reduce(
        (acc, s) => acc + (s.stockDisponibleUnits ?? 0),
        0
      );
      const consignadoReal = producto.stockSucursals.reduce(
        (acc, s) => acc + (s.stockConsignadoUnits ?? 0),
        0
      );

      const disponibleActual = producto.stockDisponibleUnits ?? 0;
      const consignadoActual = producto.stockConsignadoUnits ?? 0;

      if (disponibleActual !== disponibleReal || consignadoActual !== consignadoReal) {
        await prisma.producto.update({
          where: { id: producto.id },
          data: {
            stockDisponibleUnits: disponibleReal,
            stockConsignadoUnits: consignadoReal,
          },
        });
        actualizados++;
      } else {
        sinCambios++;
      }
    }

    return NextResponse.json({
      ok: true,
      actualizados,
      sinCambios,
      total: productos.length,
      mensaje: `Sincronización completa. ${actualizados} producto(s) corregido(s).`,
    });
  } catch (error) {
    console.error("Error en sync-stock:", error);
    return NextResponse.json({ error: "Error interno al sincronizar stock" }, { status: 500 });
  }
}
