import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const sucursalIdParam = searchParams.get("sucursalId");
  const sucursalId = sucursalIdParam ? Number(sucursalIdParam) : 1;
  
  const categoryIdParam = searchParams.get("categoryId");
  const subcategoryIdParam = searchParams.get("subcategoryId");
  const minPriceParam = searchParams.get("minPrice");
  const maxPriceParam = searchParams.get("maxPrice");
  const searchParam = searchParams.get("search");
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  
  const page = pageParam ? Math.max(1, Number(pageParam)) : 1;
  const limit = limitParam ? Math.min(100, Math.max(1, Number(limitParam))) : 20;
  const skip = (page - 1) * limit;

  const whereClause: Prisma.ProductoWhereInput = {
    activo: true,
    sucursalId,
  };

  if (categoryIdParam) {
    whereClause.categoriaId = Number(categoryIdParam);
  }

  if (subcategoryIdParam) {
    whereClause.subcategoriaId = Number(subcategoryIdParam);
  }

  if (searchParam) {
    whereClause.nombre = {
      contains: searchParam,
      mode: "insensitive",
    };
  }

  if (minPriceParam || maxPriceParam) {
    whereClause.precioVenta = {};
    if (minPriceParam) {
      whereClause.precioVenta.gte = Number(minPriceParam);
    }
    if (maxPriceParam) {
      whereClause.precioVenta.lte = Number(maxPriceParam);
    }
  }

  try {
    const [productos, total] = await Promise.all([
      prisma.producto.findMany({
        where: whereClause,
        select: {
          id: true,
          nombre: true,
          precioVenta: true,
          imagenUrl: true,
          descripcion: true,
          descuentoPorcentaje: true,
          descuentoActivo: true,
          stockDisponibleUnits: true,
          categoriaId: true,
          subcategoriaId: true,
        },
        skip,
        take: limit,
        orderBy: {
          id: "desc",
        },
      }),
      prisma.producto.count({
        where: whereClause,
      }),
    ]);

    return NextResponse.json({
      data: productos,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Error al obtener catálogo:", error);
    return NextResponse.json(
      { error: "Error al obtener catálogo de productos" },
      { status: 500 }
    );
  }
}
