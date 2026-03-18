// src/app/api/productos/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, TipoMovimientoStock, MotivoMovimientoStock } from "@prisma/client";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { createProductoSchema, type CreateProductoInput } from "@/lib/validators/producto";
import { sendNotification } from "@/lib/notificaciones/socket-trigger";
import { NOTIFICATION_TYPE } from "@/lib/notificaciones/types";
import { obtenerConfiguracionGlobal } from "@/lib/config";
import { checkProductLimit } from "@/lib/subscriptions/require-subscription";
import { buildSucursalWhere, isGlobalSucursalView } from "@/lib/sucursalScope";

type ProductoCreateBody = CreateProductoInput & {
  subcategoriaId?: number | null;
};

type ProductoListado = Prisma.ProductoGetPayload<{
  include: {
    categoria: true;
    subcategoria: true;
    stockSucursals: true;
  };
}>;

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

    const requestedSucursalId =
      auth.user.rol === "ADMIN" && Number.isFinite(sucursalParamNum) && sucursalParamNum > 0
        ? sucursalParamNum
        : auth.activeSucursalId;
    const requestedAuth = { ...auth, activeSucursalId: requestedSucursalId };
    const isGlobal = isGlobalSucursalView(requestedAuth);
    const sucursalWhere = buildSucursalWhere(requestedAuth);

    // Parámetros de paginación (backward compatible: sin page/limit → devuelve todos)
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const search = searchParams.get("search")?.trim() || "";
    const categoriaId = searchParams.get("categoriaId")?.trim() || "";
    const scope = searchParams.get("scope")?.trim() || "default";

    const isPaginated = pageParam !== null || limitParam !== null;

    // Validación explícita: limit > 200 retorna HTTP 400
    if (limitParam && parseInt(limitParam, 10) > 200) {
      return NextResponse.json(
        { error: "El parámetro 'limit' no puede superar 200." },
        { status: 400 }
      );
    }

    const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(limitParam || "50", 10) || 50));
    const skip = (page - 1) * limit;

    const whereClauses: Prisma.ProductoWhereInput[] = [{ activo: true }];
    const canUseSharedBranchScope = !isGlobal && scope === "branch-stock" && Number.isFinite(requestedSucursalId) && requestedSucursalId > 0;

    if (canUseSharedBranchScope) {
      whereClauses.push({
        OR: [
          { sucursalId: requestedSucursalId },
          { stockSucursals: { some: { sucursalId: requestedSucursalId } } },
        ],
      });
    } else if (Object.keys(sucursalWhere).length > 0) {
      whereClauses.push(sucursalWhere);
    }

    if (search) {
      whereClauses.push({
        OR: [
          { nombre: { contains: search, mode: "insensitive" } },
          { codigoBarra: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    if (categoriaId && Number.isFinite(Number(categoriaId))) {
      whereClauses.push({ categoriaId: Number(categoriaId) });
    }

    const where: Prisma.ProductoWhereInput = whereClauses.length === 1
      ? whereClauses[0]
      : { AND: whereClauses };

    const includeConfig = {
      categoria: true,
      subcategoria: true,
      stockSucursals: {
        ...(isGlobal ? {} : { where: { sucursalId: requestedSucursalId } })
      }
    } satisfies Prisma.ProductoInclude;

    const mapProducto = (p: ProductoListado) => {
      const branchStock = p.stockSucursals[0];
      const stockDisponibleGlobal = p.stockSucursals.reduce((acc, s) => acc + (s.stockDisponibleUnits || 0), 0);
      const stockConsignadoGlobal = p.stockSucursals.reduce((acc, s) => acc + (s.stockConsignadoUnits || 0), 0);
      const stockMinGlobal = p.stockSucursals.reduce((acc, s) => acc + (s.stockMinUnits || 0), 0);

      return {
        ...p,
        stockDisponibleUnits: isGlobal
          ? stockDisponibleGlobal
          : (branchStock?.stockDisponibleUnits ?? p.stockDisponibleUnits ?? 0),
        stockConsignadoUnits: isGlobal
          ? stockConsignadoGlobal
          : (branchStock?.stockConsignadoUnits ?? p.stockConsignadoUnits ?? 0),
        stockMinUnits: isGlobal
          ? stockMinGlobal
          : (branchStock?.stockMinUnits ?? p.stockMinUnits),
      };
    };

    if (!isPaginated) {
      // Sin paginación → comportamiento original
      const productos = await prisma.producto.findMany({
        where,
        include: includeConfig,
        orderBy: { id: "desc" },
      });
      return NextResponse.json({ data: productos.map(mapProducto) }, {
        headers: {
          "Cache-Control": "private, max-age=20, stale-while-revalidate=60",
        },
      });
    }

    // Con paginación → count + findMany en paralelo
    const [total, productos] = await Promise.all([
      prisma.producto.count({ where }),
      prisma.producto.findMany({
        where,
        include: includeConfig,
        orderBy: { id: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: productos.map(mapProducto),
      total,
      page,
      limit,
      totalPages,
    }, {
      headers: {
        "Cache-Control": "private, max-age=20, stale-while-revalidate=60",
      },
    });
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
    if (isGlobalSucursalView(auth)) {
      return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para crear productos." }, { status: 409 });
    }

    if (!requireRole(auth.user, ["ADMIN"])) {
      return NextResponse.json({ error: "No tienes permisos (Admin requerido)" }, { status: 403 });
    }

    const sucursalId = auth.activeSucursalId;

    // Guard: Verificar límite de productos del plan
    const productCheck = await checkProductLimit();
    if (!productCheck.allowed) {
      return NextResponse.json({ error: productCheck.message, limitReached: true }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as ProductoCreateBody | null;
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
          iva: data.iva,
          stockDisponibleUnits: stockInicial, // Global (legacy/sync)
          stockConsignadoUnits: 0,
          stockMinUnits: data.stockMinUnits ?? 0,
          packSizeUnits: data.packSizeUnits ?? null,
          codigoBarra: data.codigoBarra?.trim() || null,
          sku: data.sku?.trim() || null,
          categoriaId: data.categoriaId ?? null,
          subcategoriaId: body?.subcategoriaId ?? null,
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
          stockDisponibleUnits: stockInicial,
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
            tipo: TipoMovimientoStock.ENTRADA,
            motivo: MotivoMovimientoStock.COMPRA,
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

  } catch (error) {
    // Manejo de duplicados (Unique Constraints)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const field = Array.isArray(error.meta?.target) ? String(error.meta.target[0]) : "desconocido";
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
