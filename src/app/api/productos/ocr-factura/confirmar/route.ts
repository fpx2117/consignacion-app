// src/app/api/productos/ocr-factura/confirmar/route.ts
// Segundo paso del flujo de OCR de facturas: recibe las filas ya revisadas/editadas
// por el usuario y aplica los cambios: suma stock a productos existentes (matched) o
// crea productos nuevos, generando en ambos casos el MovimientoStock correspondiente
// (mismo patrón que src/app/api/productos/route.ts y src/app/api/productos/[id]/route.ts).

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma, TipoMovimientoStock, MotivoMovimientoStock } from "@prisma/client";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { isGlobalSucursalView } from "@/lib/security/sucursalScope";
import { checkProductLimit } from "@/lib/subscriptions/require-subscription";

const filaSchema = z.object({
  productoId: z.number().int().positive().nullish(),
  crearNuevo: z.boolean(),
  nombre: z.string().min(1, "El nombre es requerido"),
  cantidad: z.number().int().positive(),
  precioCosto: z.number().min(0).nullish(),
});

const bodySchema = z.object({
  filas: z.array(filaSchema).min(1, "No hay filas para confirmar"),
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      { error: "Vista global en modo solo lectura. Selecciona una sucursal para cargar por factura." },
      { status: 409 },
    );
  }
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No tienes permisos (Admin requerido)" }, { status: 403 });
  }

  const sucursalId = auth.activeSucursalId;
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let creados = 0;
  let actualizados = 0;
  const errores: { fila: string; error: string }[] = [];

  const hayFilasNuevas = parsed.data.filas.some((f) => f.crearNuevo || !f.productoId);
  const limiteProductos = hayFilasNuevas ? await checkProductLimit() : { allowed: true as const };

  for (const fila of parsed.data.filas) {
    try {
      if (fila.crearNuevo || !fila.productoId) {
        if (!limiteProductos.allowed) {
          errores.push({ fila: fila.nombre, error: limiteProductos.message });
          continue;
        }
        await prisma.$transaction(async (tx) => {
          const precioCosto = fila.precioCosto ?? 0;
          const nuevoProducto = await tx.producto.create({
            data: {
              nombre: fila.nombre.trim(),
              precioVenta: precioCosto > 0 ? precioCosto : 0.01,
              precioCosto,
              stockDisponibleUnits: fila.cantidad,
              stockConsignadoUnits: 0,
              stockMinUnits: 0,
              sucursalId,
            },
          });

          await tx.stockSucursal.create({
            data: {
              productoId: nuevoProducto.id,
              sucursalId,
              stockDisponibleUnits: fila.cantidad,
              stockConsignadoUnits: 0,
              stockMinUnits: 0,
            },
          });

          await tx.movimientoStock.create({
            data: {
              productoId: nuevoProducto.id,
              sucursalId,
              tipo: TipoMovimientoStock.ENTRADA,
              motivo: MotivoMovimientoStock.COMPRA,
              cantidad: fila.cantidad,
              stockPrevio: 0,
              stockPosterior: fila.cantidad,
              observaciones: "Carga por OCR de factura (producto nuevo)",
            },
          });
        });
        creados++;
      } else {
        await prisma.$transaction(async (tx) => {
          const stockActual = await tx.stockSucursal.findUnique({
            where: { productoId_sucursalId: { productoId: fila.productoId!, sucursalId } },
          });

          const stockPrevio = stockActual?.stockDisponibleUnits ?? 0;
          const stockPosterior = stockPrevio + fila.cantidad;

          await tx.stockSucursal.upsert({
            where: { productoId_sucursalId: { productoId: fila.productoId!, sucursalId } },
            create: {
              productoId: fila.productoId!,
              sucursalId,
              stockDisponibleUnits: stockPosterior,
              stockConsignadoUnits: 0,
              stockMinUnits: 0,
            },
            update: { stockDisponibleUnits: stockPosterior },
          });

          const todosStocks = await tx.stockSucursal.findMany({
            where: { productoId: fila.productoId! },
            select: { stockDisponibleUnits: true },
          });
          const stockGlobal = todosStocks.reduce((acc, s) => acc + (s.stockDisponibleUnits ?? 0), 0);

          await tx.producto.update({
            where: { id: fila.productoId! },
            data: { stockDisponibleUnits: stockGlobal },
          });

          await tx.movimientoStock.create({
            data: {
              productoId: fila.productoId!,
              sucursalId,
              tipo: TipoMovimientoStock.ENTRADA,
              motivo: MotivoMovimientoStock.COMPRA,
              cantidad: fila.cantidad,
              stockPrevio,
              stockPosterior,
              observaciones: "Carga por OCR de factura",
            },
          });
        });
        actualizados++;
      }
    } catch (error) {
      const mensaje =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? `Error de base de datos (${error.code})`
          : error instanceof Error
            ? error.message
            : "Error desconocido";
      errores.push({ fila: fila.nombre, error: mensaje });
    }
  }

  return NextResponse.json({ data: { creados, actualizados, errores } });
}
