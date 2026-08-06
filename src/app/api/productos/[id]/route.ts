// src/app/api/productos/[id]/route.ts

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  Prisma,
  TipoMovimientoStock,
  MotivoMovimientoStock,
} from "@prisma/client";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import {
  updateProductoSchema,
  type UpdateProductoInput,
} from "@/lib/validators/producto";
import { validarAtributosFijosProducto } from "@/lib/validators/producto-atributos-fijos";
import { deleteFileSystemImage } from "@/lib/uploads/file-utils";

// Imports del Sistema de Notificaciones
import { sendNotification } from "@/lib/notificaciones/socket-trigger";
import { NOTIFICATION_TYPE } from "@/lib/notificaciones/types";
import { obtenerConfiguracionGlobal } from "@/lib/config";
import {
  canAccessSucursalResource,
  isGlobalSucursalView,
} from "@/lib/security/sucursalScope";
import { calcularDescuentoEfectivo } from "@/lib/storefront/descuento-utils";

type RouteParams = { params: Promise<{ id: string }> };

type ProductoUpdateBody = UpdateProductoInput & {
  subcategoriaId?: number | null;
  movimientoInfo?: {
    tipo: TipoMovimientoStock;
    motivo: MotivoMovimientoStock;
    observaciones?: string | null;
  };
};

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

    if (isNaN(id))
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const producto = await prisma.producto.findFirst({
      where: isGlobal ? { id } : { id, sucursalId },
      include: {
        categoria: true,
        subcategoria: true, // Incluimos subcategoría
        stockSucursals: {
          ...(isGlobal ? {} : { where: { sucursalId } }),
        },
      },
    });

    if (!producto || !canAccessSucursalResource(auth, producto.sucursalId)) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 },
      );
    }

    // Mapeamos para devolver el stock de la sucursal activa
    const branchStock = producto.stockSucursals[0];
    const stockDisponibleGlobal = producto.stockSucursals.reduce(
      (acc, s) => acc + (s.stockDisponibleUnits || 0),
      0,
    );
    const stockConsignadoGlobal = producto.stockSucursals.reduce(
      (acc, s) => acc + (s.stockConsignadoUnits || 0),
      0,
    );
    const stockMinGlobal = producto.stockSucursals.reduce(
      (acc, s) => acc + (s.stockMinUnits || 0),
      0,
    );

    const precioEfectivo = Number(
      branchStock?.precioVentaOverride ?? producto.precioVenta,
    );

    const data = {
      ...producto,
      stockDisponibleUnits: isGlobal
        ? stockDisponibleGlobal
        : (branchStock?.stockDisponibleUnits ??
          producto.stockDisponibleUnits ??
          0),
      stockConsignadoUnits: isGlobal
        ? stockConsignadoGlobal
        : (branchStock?.stockConsignadoUnits ??
          producto.stockConsignadoUnits ??
          0),
      stockMinUnits: isGlobal
        ? stockMinGlobal
        : (branchStock?.stockMinUnits ?? producto.stockMinUnits),
      descuentoEfectivo: calcularDescuentoEfectivo({
        descuentoActivo: producto.descuentoActivo,
        tipoDescuento: producto.tipoDescuento,
        descuentoPorcentaje: producto.descuentoPorcentaje
          ? Number(producto.descuentoPorcentaje)
          : null,
        descuentoMonto: producto.descuentoMonto
          ? Number(producto.descuentoMonto)
          : null,
        descuentoDesde: producto.descuentoDesde,
        descuentoHasta: producto.descuentoHasta,
        precioVenta: precioEfectivo,
      }),
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
    return NextResponse.json(
      {
        error:
          "Vista global en modo solo lectura. Selecciona una sucursal para editar productos.",
      },
      { status: 409 },
    );
  }

  // Solo ADMIN puede editar productos
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  const sucursalId = auth.activeSucursalId;

  if (isNaN(id))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = (await req
    .json()
    .catch(() => null)) as ProductoUpdateBody | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  // Extraemos movimientoInfo si viene del AjustarStockDialog
  const { movimientoInfo, ...restOfBody } = body;

  const parsed = updateProductoSchema.safeParse(restOfBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validación fallida",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const configGlobal = await obtenerConfiguracionGlobal(auth.activeSucursalId);

  // Solo validamos atributos fijos si este PUT efectivamente toca
  // atributosExtra — un ajuste parcial de stock (ajustar-stock-dialog) no
  // lo envía y no debe verse bloqueado por requeridos de otro campo.
  if (parsed.data.atributosExtra !== undefined) {
    const atributosError = validarAtributosFijosProducto(
      parsed.data.atributosExtra,
      configGlobal.rubroNegocio,
    );
    if (atributosError) {
      return NextResponse.json(
        { error: "Validación fallida", details: atributosError.fieldErrors },
        { status: 400 },
      );
    }
  }

  try {
    // --- TRANSACCIÓN PARA ACTUALIZAR Y REGISTRAR MOVIMIENTO ---
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Obtener estado actual de la sucursal antes de la actualización
      const anterior = await tx.stockSucursal.findUnique({
        where: { productoId_sucursalId: { productoId: id, sucursalId } },
      });

      const anteriorProducto = await tx.producto.findFirst({
        where: { id, sucursalId },
        select: { imagenUrl: true },
      });

      if (!anteriorProducto) throw new Error("Producto no encontrado");

      // 2. Ejecutar la actualización del producto (datos base)
      const productoUpdate = await tx.producto.update({
        where: { id },
        data: {
          ...parsed.data,
          subcategoriaId:
            body.subcategoriaId !== undefined ? body.subcategoriaId : undefined,
          fechaVencimiento: parsed.data.fechaVencimiento
            ? new Date(parsed.data.fechaVencimiento)
            : undefined,
          tipoDescuento: parsed.data.tipoDescuento ?? undefined,
          descuentoMonto:
            parsed.data.descuentoMonto !== undefined
              ? parsed.data.descuentoMonto
              : undefined,
          descuentoDesde: parsed.data.descuentoDesde
            ? new Date(parsed.data.descuentoDesde)
            : parsed.data.descuentoDesde === null
              ? null
              : undefined,
          descuentoHasta: parsed.data.descuentoHasta
            ? new Date(parsed.data.descuentoHasta)
            : parsed.data.descuentoHasta === null
              ? null
              : undefined,
          atributosExtra:
            parsed.data.atributosExtra === undefined
              ? undefined
              : parsed.data.atributosExtra === null
                ? Prisma.JsonNull
                : parsed.data.atributosExtra,
        },
      });

      // 2.5. Si cambió la imagen, borrar la vieja
      if (
        parsed.data.imagenUrl !== undefined &&
        anteriorProducto.imagenUrl &&
        anteriorProducto.imagenUrl !== parsed.data.imagenUrl
      ) {
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
          stockMinUnits:
            stockMin !== undefined
              ? stockMin
              : (parsed.data.stockMinUnits ?? 0),
        },
        update: {
          stockDisponibleUnits:
            nuevoStock !== undefined ? nuevoStock : undefined,
          stockMinUnits: stockMin !== undefined ? stockMin : undefined,
        },
      });

      // 3.5. Sincronizar Producto.stockDisponibleUnits con la suma de todas las sucursales
      if (nuevoStock !== undefined) {
        const allStocksSucursal = await tx.stockSucursal.findMany({
          where: { productoId: id },
          select: { stockDisponibleUnits: true },
        });
        const stockGlobalSincronizado = allStocksSucursal.reduce(
          (acc, s) => acc + (s.stockDisponibleUnits ?? 0),
          0,
        );
        await tx.producto.update({
          where: { id },
          data: { stockDisponibleUnits: stockGlobalSincronizado },
        });
      }

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
              observaciones:
                movimientoInfo.observaciones || "Ajuste manual de stock",
            },
          });
        }
      }

      return {
        ...productoUpdate,
        stockDisponibleUnits: stockSucursalUpdate.stockDisponibleUnits,
        stockConsignadoUnits: stockSucursalUpdate.stockConsignadoUnits,
        stockMinUnits: stockSucursalUpdate.stockMinUnits,
        // Nota: productoUpdate.stockDisponibleUnits fue sincronizado al global arriba,
        // pero devolvemos el valor de la sucursal activa para el UI
      };
    });

    // --- LÓGICA DE NOTIFICACIÓN POR STOCK ---
    if (parsed.data.stockDisponibleUnits !== undefined) {
      const nuevoStock = updated.stockDisponibleUnits;
      const umbralAlerta =
        updated.stockMinUnits > 0
          ? updated.stockMinUnits
          : configGlobal.minStockGlobal;

      const fechaVencMsg = updated.fechaVencimiento
        ? ` (Vence el: ${new Date(updated.fechaVencimiento).toLocaleDateString("es-AR")})`
        : "";

      if (nuevoStock <= 0) {
        await sendNotification({
          type: NOTIFICATION_TYPE.OUT_OF_STOCK,
          title: "⚠️ Stock Agotado",
          message: `El producto "${updated.nombre}" se quedó sin unidades en esta sucursal.${fechaVencMsg}`,
          data: { productId: updated.id },
        });
      } else if (nuevoStock <= umbralAlerta) {
        await sendNotification({
          type: NOTIFICATION_TYPE.LOW_STOCK,
          title: "⚡ Stock Bajo",
          message: `"${updated.nombre}" alcanzó el nivel crítico con ${nuevoStock} u. en esta sucursal.${fechaVencMsg}`,
          data: { productId: updated.id },
        });
      }
    }

    // Invalidar caché del catálogo público para que los cambios (precio, descuento, imagen, etc.) se reflejen de inmediato
    revalidateTag("public-catalog", "default");

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "El código de barras o SKU ya está en uso por otro producto.",
        },
        { status: 400 },
      );
    }
    console.error("Error al actualizar producto:", error);
    return NextResponse.json(
      { error: "Error interno al actualizar" },
      { status: 500 },
    );
  }
}

/**
 * DELETE: Desactivación lógica
 */
export async function DELETE(_: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      {
        error:
          "Vista global en modo solo lectura. Selecciona una sucursal para eliminar productos.",
      },
      { status: 409 },
    );
  }
  if (!requireRole(auth.user, ["ADMIN"]))
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id: rawId } = await params;
  const id = Number(rawId);

  try {
    const oldProduct = await prisma.producto.findFirst({
      where: { id, sucursalId: auth.activeSucursalId },
      select: { imagenUrl: true },
    });

    if (!oldProduct) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 },
      );
    }

    await prisma.producto.update({
      where: { id },
      data: { activo: false },
    });

    if (oldProduct?.imagenUrl) {
      await deleteFileSystemImage(oldProduct.imagenUrl);
      await prisma.producto.update({
        where: { id },
        data: { imagenUrl: null },
      });
    }

    // Invalidar caché del catálogo público tras desactivar producto
    revalidateTag("public-catalog", "default");

    return NextResponse.json({
      data: {
        success: true,
        message: "Producto desactivado e imagen eliminada",
      },
    });
  } catch (error) {
    console.error("Error al desactivar producto:", error);
    return NextResponse.json(
      { error: "No se pudo desactivar el producto" },
      { status: 500 },
    );
  }
}
