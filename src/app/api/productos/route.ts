/* eslint-disable */
// @ts-nocheck
// src/app/api/productos/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/requireAuth";
import { createProductoSchema } from "@/lib/validators/producto";
import { sendNotification } from "@/lib/socket-trigger";
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types";
import { obtenerConfiguracionGlobal } from "@/lib/config";
import { checkProductLimit } from "@/lib/requireSubscription";

/**
 * GET: OBTENER PRODUCTOS
 * Trae todos los productos activos con sus categorías y subcategorías.
 */
export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { searchParams } = new URL(req.url);
    const sucursalParam = searchParams.get("sucursalId");
    const sucursalParamNum = sucursalParam ? Number(sucursalParam) : NaN;

    const sucursalId =
      auth.user.rol === "ADMIN" && Number.isFinite(sucursalParamNum) && sucursalParamNum > 0
        ? sucursalParamNum
        : auth.activeSucursalId;

    const productos = await prisma.producto.findMany({
      where: {
        activo: true,
        sucursalId
      },
      include: {
        categoria: true,
        subcategoria: true,
        stockSucursals: {
          where: { sucursalId }
        }
      },
      orderBy: { id: "desc" },
    });

    // Mapeamos para que el frontend reciba el stock de la sucursal activa
    const mapped = productos.map(p => {
      const branchStock = p.stockSucursals[0];
      return {
        ...p,
        stockDisponibleUnits: branchStock?.stockDisponibleUnits ?? p.stockDisponibleUnits ?? 0,
        stockConsignadoUnits: branchStock?.stockConsignadoUnits ?? p.stockConsignadoUnits ?? 0,
        stockMinUnits: branchStock?.stockMinUnits ?? p.stockMinUnits,
      };
    });

    return NextResponse.json({ data: mapped });
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
 * Crea el producto, el registro de stock para la sucursal actual y registra el movimiento inicial.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    if (!requireRole(auth.user, ["ADMIN"])) {
      return NextResponse.json({ error: "No tienes permisos (Admin requerido)" }, { status: 403 });
    }

    const sucursalId = auth.activeSucursalId;

    // Guard: Verificar límite de productos del plan
    const productCheck = await checkProductLimit();
    if (!productCheck.allowed) {
      return NextResponse.json({ error: productCheck.message, limitReached: true }, { status: 403 });
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
    const created = await prisma.$transaction(async (tx) => {

      // 1. Crear el producto
      const nuevoProducto = await tx.producto.create({
        data: {
          nombre: data.nombre,
          descripcion: data.descripcion,
          precioVenta: data.precioVenta,
          precioCosto: data.precioCosto,
          stockDisponibleUnits: stockInicial, // Global (legacy/sync)
          stockConsignadoUnits: 0,
          stockMinUnits: data.stockMinUnits ?? 0,
          packSizeUnits: data.packSizeUnits ?? null,
          codigoBarra: data.codigoBarra?.trim() || null,
          sku: data.sku?.trim() || null,
          categoriaId: data.categoriaId ?? null,
          subcategoriaId: body.subcategoriaId ?? null,
          fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
          imagenUrl: data.imagenUrl || null,
          sucursalId,
        },
        include: { categoria: true, subcategoria: true }
      });

      // 2. Crear el registro de StockSucursal para la sucursal activa
      await tx.stockSucursal.create({
        data: {
          productoId: nuevoProducto.id,
          sucursalId,
          stockDisponibleUnits: stockInitial,
          stockConsignadoUnits: 0,
          stockMinUnits: data.stockMinUnits ?? 0,
        }
      });

      // 3. Registrar el movimiento inicial
      if (stockInicial > 0) {
        await tx.movimientoStock.create({
          data: {
            productoId: nuevoProducto.id,
            sucursalId,
            tipo: "ENTRADA",
            motivo: "COMPRA",
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
    const configGlobal = await obtenerConfiguracionGlobal(auth.activeSucursalId);
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

    console.error("Error al obtener productos:", error);
    return NextResponse.json(
      { error: "Error interno al obtener productos" },
      { status: 500 }
    );
  }
}
