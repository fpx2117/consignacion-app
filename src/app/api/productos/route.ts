// src/app/api/productos/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/requireAuth";
import { createProductoSchema } from "@/lib/validators/producto";
import { sendNotification } from "@/lib/socket-trigger";
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types"; 
import { obtenerConfiguracionGlobal } from "@/lib/config";

/**
 * GET: OBTENER PRODUCTOS
 * Trae todos los productos activos con sus categorías.
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const productos = await prisma.producto.findMany({
      where: { activo: true },
      include: { categoria: true },
      orderBy: { id: "desc" },
    });

    return NextResponse.json({ data: productos });
  } catch (error) {
    console.error("Error obteniendo productos:", error);
    return NextResponse.json(
      { error: "Error interno al obtener productos" },
      { status: 500 }
    );
  }
}

/**
 * POST: CREAR PRODUCTO
 * Crea el producto y registra el movimiento inicial en el historial.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    if (!requireRole(auth.user, ["ADMIN"])) {
      return NextResponse.json({ error: "No tienes permisos (Admin requerido)" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createProductoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { 
          error: "Validación fallida", 
          details: parsed.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const stockInicial = data.stockDisponibleUnits ?? 0;

    // --- TRANSACCIÓN ATÓMICA ---
    // Usamos $transaction para asegurar que el producto y su historial se creen juntos
    const created = await prisma.$transaction(async (tx) => {
      
      // 1. Crear el producto
      const nuevoProducto = await tx.producto.create({
        data: {
          nombre: data.nombre,
          descripcion: data.descripcion,
          precioVenta: data.precioVenta,
          precioCosto: data.precioCosto,
          stockDisponibleUnits: stockInicial,
          stockConsignadoUnits: 0,
          stockMinUnits: data.stockMinUnits ?? 0,
          packSizeUnits: data.packSizeUnits ?? null,
          codigoBarra: data.codigoBarra?.trim() || null,
          sku: data.sku?.trim() || null,
          categoriaId: data.categoriaId ?? null,
          fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
        },
        include: { categoria: true }
      });

      // 2. Registrar el movimiento inicial si el stock es mayor a 0
      if (stockInicial > 0) {
        await tx.movimientoStock.create({
          data: {
            productoId: nuevoProducto.id,
            tipo: "ENTRADA",
            motivo: "COMPRA", // Se asume compra como motivo inicial por defecto
            cantidad: stockInicial,
            stockPrevio: 0,
            stockPosterior: stockInicial,
            observaciones: "Carga inicial de stock al crear producto",
          }
        });
      }

      return nuevoProducto;
    });

    // --- LÓGICA DE NOTIFICACIONES ---
    const configGlobal = await obtenerConfiguracionGlobal();
    const umbralAlerta = created.stockMinUnits > 0 
      ? created.stockMinUnits 
      : configGlobal.minStockGlobal;

    if (stockInicial === 0) {
      await sendNotification({
        type: NOTIFICATION_TYPE.OUT_OF_STOCK,
        title: "Nuevo Producto Sin Stock",
        message: `Se ha creado "${created.nombre}" sin inventario.`,
        data: { productId: created.id }
      });
    } else if (stockInicial <= umbralAlerta) {
      await sendNotification({
        type: NOTIFICATION_TYPE.LOW_STOCK,
        title: "Stock Bajo al Crear",
        message: `"${created.nombre}" inicia con ${stockInicial} u. (Mínimo: ${umbralAlerta}).`,
        data: { productId: created.id }
      });
    }

    return NextResponse.json({ data: created }, { status: 201 });

  } catch (error: any) {
    // Manejo de duplicados (Unique Constraints)
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      return NextResponse.json(
        { error: `El valor en el campo '${field}' ya está registrado en otro producto.` },
        { status: 400 }
      );
    }

    console.error("Error creando producto:", error);
    return NextResponse.json(
      { error: "Error interno al crear el producto" },
      { status: 500 }
    );
  }
}