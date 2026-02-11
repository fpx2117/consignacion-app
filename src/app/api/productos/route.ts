// src/app/api/productos/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/requireAuth";
import { createProductoSchema } from "@/lib/validators/producto";
import { sendNotification } from "@/lib/socket-trigger";
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types"; 
import { obtenerConfiguracionGlobal } from "@/lib/config";

// --- GET: OBTENER PRODUCTOS ---
export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const productos = await prisma.producto.findMany({
      where: { activo: true }, // 👈 Solo traer productos no "eliminados"
      include: { categoria: true }, // 👈 Incluir el nombre de la categoría
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

// --- POST: CREAR PRODUCTO ---
export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    if (!requireRole(auth.user, ["ADMIN"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const {
      nombre,
      precioVenta,
      precioCosto,
      stockDisponibleUnits,
      stockMinUnits,
      packSizeUnits,
      fechaVencimiento,
      codigoBarra, // 👈 Nuevo
      sku,         // 👈 Nuevo
      categoriaId  // 👈 Nuevo
    } = parsed.data;

    const stockInicial = stockDisponibleUnits ?? 0;
    const configGlobal = await obtenerConfiguracionGlobal();
    
    // Umbral: Prioridad al específico del producto, si no, al global.
    const umbralAlerta = stockMinUnits && stockMinUnits > 0 
      ? stockMinUnits 
      : configGlobal.minStockGlobal;

    // --- CREAR EN BASE DE DATOS ---
    const created = await prisma.producto.create({
      data: {
        nombre,
        precioVenta,
        precioCosto,
        stockDisponibleUnits: stockInicial,
        stockConsignadoUnits: 0,
        stockMinUnits: stockMinUnits ?? 0,
        packSizeUnits: packSizeUnits ?? null,
        codigoBarra: codigoBarra?.trim() || null, // 👈 Persistir código
        sku: sku?.trim() || null,                 // 👈 Persistir SKU
        categoriaId: categoriaId ?? null,         // 👈 Relación
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
      },
      include: { categoria: true }
    });

    // --- LÓGICA DE NOTIFICACIÓN ---
    if (stockInicial === 0) {
      await sendNotification({
        type: NOTIFICATION_TYPE.OUT_OF_STOCK,
        title: "Nuevo Producto Sin Stock",
        message: `Se ha creado "${created.nombre}" sin inventario.`,
        data: { productId: created.id }
      });
    } 
    else if (stockInicial <= umbralAlerta) {
      await sendNotification({
        type: NOTIFICATION_TYPE.LOW_STOCK,
        title: "Stock Bajo al Crear",
        message: `"${created.nombre}" inicia con ${stockInicial} u. (Mínimo: ${umbralAlerta}).`,
        data: { productId: created.id }
      });
    }

    return NextResponse.json({ data: created }, { status: 201 });

  } catch (error: any) {
    // 👈 Manejo de error de duplicados (P2002 es el código de Prisma para Unique Constraint)
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      return NextResponse.json(
        { error: `El ${field} ya está registrado en otro producto.` },
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