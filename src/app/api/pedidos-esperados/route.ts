/* eslint-disable */
// @ts-nocheck
// src/app/api/pedidos-esperados/route.ts
// GET: Lista pedidos de la sucursal activa (con lazy check de vencidos)
// POST: Crea nuevo pedido con items

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/requireAuth";
import { createPedidoSchema } from "@/lib/validators/pedidos-esperados";
import { checkAndUpdateVencidos } from "@/lib/pedidos-esperados";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/pedidos-esperados
 * Lista pedidos de la sucursal activa con sus items y productos.
 * Soporta query params: estado, fechaDesde, fechaHasta
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const sucursalId = auth.activeSucursalId;
    const { searchParams } = new URL(req.url);

    const estados = searchParams.getAll("estado").filter(Boolean);
    const fechaDesdeRaw = searchParams.get("fechaDesde") ?? undefined;
    const fechaHastaRaw = searchParams.get("fechaHasta") ?? undefined;

    // Lazy check: actualizar pedidos vencidos antes de retornar la lista
    // Si falla la notificacion/actualizacion no debe romper el listado.
    try {
      await checkAndUpdateVencidos(sucursalId);
    } catch (lazyCheckError) {
      console.error("Error en checkAndUpdateVencidos (continuando listado):", lazyCheckError);
    }

    const fechaDesde = fechaDesdeRaw ? new Date(fechaDesdeRaw) : undefined;
    const fechaHasta = fechaHastaRaw ? new Date(fechaHastaRaw) : undefined;

    const pedidos = await prisma.pedidoEsperado.findMany({
      where: {
        sucursalId,
        ...(estados.length === 1
          ? { estado: estados[0] }
          : estados.length > 1
          ? { estado: { in: estados } }
          : {}),
        ...(fechaDesde || fechaHasta
          ? {
              fechaEsperada: {
                ...(fechaDesde ? { gte: fechaDesde } : {}),
                ...(fechaHasta ? { lte: fechaHasta } : {}),
              },
            }
          : {}),
      },
      include: {
        items: true,
      },
      orderBy: { fechaEsperada: "asc" },
    });

    const productoIds = Array.from(
      new Set(pedidos.flatMap((pedido) => pedido.items.map((item) => item.productoId)))
    );

    const productos = productoIds.length
      ? await prisma.producto.findMany({
          where: { id: { in: productoIds } },
          select: {
            id: true,
            nombre: true,
            sku: true,
            stockSucursals: {
              where: { sucursalId },
              select: { stockDisponibleUnits: true },
            },
          },
        })
      : [];

    const productoMap = new Map(productos.map((p) => [p.id, p]));

    // Aplanar stockDisponibleUnits del producto
    const data = pedidos.map((pedido) => ({
      ...pedido,
      items: pedido.items.map((item) => {
        const producto = productoMap.get(item.productoId);
        return {
          ...item,
          producto: {
            id: item.productoId,
            nombre: producto?.nombre ?? "Producto eliminado",
            sku: producto?.sku ?? null,
            stockDisponibleUnits: producto?.stockSucursals?.[0]?.stockDisponibleUnits ?? 0,
          },
        };
      }),
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error al obtener pedidos esperados:", error);

    if ((error as any)?.code === "P2021") {
      return NextResponse.json({
        data: [],
        warning: "El modulo de pedidos esperados aun no esta inicializado en esta base de datos.",
      });
    }

    return NextResponse.json(
      { error: "Error interno al obtener pedidos" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pedidos-esperados
 * Crea un nuevo pedido con sus items.
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json(
      { error: "No tienes permisos (Admin requerido)" },
      { status: 403 }
    );
  }

  try {
    const sucursalId = auth.activeSucursalId;
    const creadoPor = Number(auth.user.sub);

    const body = await req.json().catch(() => null);
    const parsed = createPedidoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validación fallida", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { fechaEsperada, observaciones, items } = parsed.data;

    // Verificar que todos los productoId existen y están activos en la sucursal
    const productoIds = items.map((i) => i.productoId);
    const productos = await prisma.producto.findMany({
      where: {
        id: { in: productoIds },
        activo: true,
        sucursalId,
      },
      select: { id: true },
    });

    if (productos.length !== productoIds.length) {
      const encontrados = new Set(productos.map((p) => p.id));
      const faltantes = productoIds.filter((id) => !encontrados.has(id));
      return NextResponse.json(
        {
          error: "Algunos productos no existen o no están activos en esta sucursal",
          productosFaltantes: faltantes,
        },
        { status: 400 }
      );
    }

    // Crear pedido con items en una sola transacción
    const pedido = await prisma.$transaction(async (tx) => {
      return tx.pedidoEsperado.create({
        data: {
          sucursalId,
          fechaEsperada: new Date(fechaEsperada),
          observaciones: observaciones ?? null,
          estado: "PROGRAMADO",
          creadoPor,
          items: {
            create: items.map((item) => ({
              productoId: item.productoId,
              cantidadEsperada: item.cantidadEsperada,
              cantidadRecibida: 0,
              estado: "PENDIENTE",
            })),
          },
        },
        include: {
          items: {
            include: {
              producto: {
                select: { id: true, nombre: true, sku: true },
              },
            },
          },
        },
      });
    });

    return NextResponse.json({ data: pedido }, { status: 201 });
  } catch (error) {
    console.error("Error al crear pedido esperado:", error);

    if ((error as any)?.code === "P2021") {
      return NextResponse.json(
        { error: "El modulo de pedidos esperados aun no esta inicializado en esta base de datos" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Error interno al crear pedido" },
      { status: 500 }
    );
  }
}
