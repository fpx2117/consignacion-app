/* eslint-disable */
// @ts-nocheck
// src/app/api/productos/[id]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/requireAuth";
import { updateProductoSchema } from "@/lib/validators/producto";
import { deleteFileSystemImage } from "@/lib/file-utils";

// Imports del Sistema de Notificaciones
import { sendNotification } from "@/lib/socket-trigger";
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types";
import { obtenerConfiguracionGlobal } from "@/lib/config";
import { canAccessSucursalResource, isGlobalSucursalView } from "@/lib/sucursalScope";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET: Obtener un producto por ID
 */
export async function GET(_: Request, { params }: RouteParams) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { id: rawId } = await params;
    const id = Number(rawId);
    const sucursalId = auth.activeSucursalId;
    const isGlobal = isGlobalSucursalView(auth);

    if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const producto = await prisma.producto.findUnique({
      where: { id },
      include: {
        categoria: true,
        subcategoria: true, // Incluimos subcategoría
        stockSucursals: {
          ...(isGlobal ? {} : { where: { sucursalId } })
        }
      }
    });

    if (!producto || !canAccessSucursalResource(auth, producto.sucursalId)) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    // Mapeamos para devolver el stock de la sucursal activa
    const branchStock = producto.stockSucursals[0];
    const stockDisponibleGlobal = producto.stockSucursals.reduce((acc, s) => acc + (s.stockDisponibleUnits || 0), 0);
    const stockConsignadoGlobal = producto.stockSucursals.reduce((acc, s) => acc + (s.stockConsignadoUnits || 0), 0);
    const stockMinGlobal = producto.stockSucursals.reduce((acc, s) => acc + (s.stockMinUnits || 0), 0);

    const data = {
      ...producto,
      stockDisponibleUnits: isGlobal
        ? stockDisponibleGlobal
        : (branchStock?.stockDisponibleUnits ?? producto.stockDisponibleUnits ?? 0),
      stockConsignadoUnits: isGlobal
        ? stockConsignadoGlobal
        : (branchStock?.stockConsignadoUnits ?? producto.stockConsignadoUnits ?? 0),
      stockMinUnits: isGlobal
        ? stockMinGlobal
        : (branchStock?.stockMinUnits ?? producto.stockMinUnits),
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error al obtener producto:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PUT: Actualizar datos del producto + Registro de Movimiento de Stock
 */
export async function PUT(req: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para editar productos." }, { status: 409 });
  }

  // Solo ADMIN puede editar productos
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  const sucursalId = auth.activeSucursalId;

  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json().catch(() => null);

  // Extraemos movimientoInfo si viene del AjustarStockDialog
  const { movimientoInfo, ...restOfBody } = body;

  const parsed = updateProductoSchema.safeParse(restOfBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const configGlobal = await obtenerConfiguracionGlobal();

    // --- TRANSACCIÓN PARA ACTUALIZAR Y REGISTRAR MOVIMIENTO ---
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Obtener estado actual de la sucursal antes de la actualización
      const anterior = await tx.stockSucursal.findUnique({
        where: { productoId_sucursalId: { productoId: id, sucursalId } },
      });

      const anteriorProducto = await tx.producto.findUnique({
        where: { id, sucursalId },
        select: { imagenUrl: true }
      });

      if (!anteriorProducto) throw new Error("Producto no encontrado");

      // 2. Ejecutar la actualización del producto (datos base)
      const productoUpdate = await tx.producto.update({
        where: { id, sucursalId },
        data: {
          ...parsed.data,
          subcategoriaId: body.subcategoriaId !== undefined ? body.subcategoriaId : undefined,
          fechaVencimiento: parsed.data.fechaVencimiento ? new Date(parsed.data.fechaVencimiento) : undefined,
        },
      });

      // 2.5. Si cambió la imagen, borrar la vieja
      if (parsed.data.imagenUrl !== undefined && anteriorProducto.imagenUrl && anteriorProducto.imagenUrl !== parsed.data.imagenUrl) {
        await deleteFileSystemImage(anteriorProducto.imagenUrl);
      }

      // 3. Actualizar o crear registro en StockSucursal
      const nuevoStock = parsed.data.stockDisponibleUnits;
      const stockMin = parsed.data.stockMinUnits;

      const stockSucursalUpdate = await tx.stockSucursal.upsert({
        where: { productoId_sucursalId: { productoId: id, sucursalId } },
        create: {
          productoId: id,
          sucursalId,
          stockDisponibleUnits: nuevoStock !== undefined ? nuevoStock : 0,
          stockMinUnits: stockMin !== undefined ? stockMin : (parsed.data.stockMinUnits ?? 0),
        },
        update: {
          stockDisponibleUnits: nuevoStock !== undefined ? nuevoStock : undefined,
          stockMinUnits: stockMin !== undefined ? stockMin : undefined,
        }
      });

      // 4. Si hubo cambio de stock y tenemos información del movimiento, registrarlo
      if (movimientoInfo && nuevoStock !== undefined) {
        const stockPrevio = anterior?.stockDisponibleUnits ?? 0;
        const stockPosterior = nuevoStock;

        if (stockPrevio !== stockPosterior) {
          await tx.movimientoStock.create({
            data: {
              productoId: id,
              sucursalId,
              tipo: movimientoInfo.tipo,
              motivo: movimientoInfo.motivo,
              cantidad: Math.abs(stockPosterior - stockPrevio),
              stockPrevio: stockPrevio,
              stockPosterior: stockPosterior,
              observaciones: movimientoInfo.observaciones || "Ajuste manual de stock",
            }
          });
        }
      }

      return {
        ...productoUpdate,
        stockDisponibleUnits: stockSucursalUpdate.stockDisponibleUnits,
        stockConsignadoUnits: stockSucursalUpdate.stockConsignadoUnits,
        stockMinUnits: stockSucursalUpdate.stockMinUnits,
      };
    });

    // --- LÓGICA DE NOTIFICACIÓN POR STOCK ---
    if (parsed.data.stockDisponibleUnits !== undefined) {
      const nuevoStock = updated.stockDisponibleUnits;
      const umbralAlerta = updated.stockMinUnits > 0
        ? updated.stockMinUnits
        : configGlobal.minStockGlobal;

      const fechaVencMsg = updated.fechaVencimiento
        ? ` (Vence el: ${new Date(updated.fechaVencimiento).toLocaleDateString('es-AR')})`
        : "";

      if (nuevoStock <= 0) {
        await sendNotification({
          type: NOTIFICATION_TYPE.OUT_OF_STOCK,
          title: "⚠️ Stock Agotado",
          message: `El producto "${updated.nombre}" se quedó sin unidades en esta sucursal.${fechaVencMsg}`,
          data: { productId: updated.id }
        });
      } else if (nuevoStock <= umbralAlerta) {
        await sendNotification({
          type: NOTIFICATION_TYPE.LOW_STOCK,
          title: "⚡ Stock Bajo",
          message: `"${updated.nombre}" alcanzó el nivel crítico con ${nuevoStock} u. en esta sucursal.${fechaVencMsg}`,
          data: { productId: updated.id }
        });
      }
    }

    return NextResponse.json({ data: updated });

  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "El código de barras o SKU ya está en uso por otro producto." },
        { status: 400 }
      );
    }
    console.error("Error al actualizar producto:", error);
    return NextResponse.json({ error: "Error interno al actualizar" }, { status: 500 });
  }
}

/**
 * DELETE: Desactivación lógica
 */
export async function DELETE(_: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para eliminar productos." }, { status: 409 });
  }
  if (!requireRole(auth.user, ["ADMIN"])) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id: rawId } = await params;
  const id = Number(rawId);

  try {
    const oldProduct = await prisma.producto.findUnique({
      where: { id, sucursalId: auth.activeSucursalId },
      select: { imagenUrl: true }
    });

    await prisma.producto.update({
      where: { id, sucursalId: auth.activeSucursalId },
      data: { activo: false }
    });

    if (oldProduct?.imagenUrl) {
      await deleteFileSystemImage(oldProduct.imagenUrl);
      await prisma.producto.update({
        where: { id },
        data: { imagenUrl: null }
      });
    }

    return NextResponse.json({ data: { success: true, message: "Producto desactivado e imagen eliminada" } });
  } catch (error) {
    console.error("Error al desactivar producto:", error);
    return NextResponse.json({ error: "No se pudo desactivar el producto" }, { status: 500 });
  }
}
