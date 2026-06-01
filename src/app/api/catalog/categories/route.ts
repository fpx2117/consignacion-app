import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sucursalIdParam = searchParams.get("sucursalId");
  const sucursalId = sucursalIdParam ? Number(sucursalIdParam) : 1;
  const includeEmpty = searchParams.get("includeEmpty") === "true";

  try {
    const categorias = await prisma.categoria.findMany({
      where: includeEmpty
        ? { sucursalId }
        : {
            sucursalId,
            productos: {
              some: {
                activo: true,
              },
            },
          },
      include: {
        subcategorias: {
          where: includeEmpty
            ? undefined
            : {
                productos: {
                  some: {
                    activo: true,
                    sucursalId,
                  },
                },
              },
          orderBy: { nombre: "asc" },
        },
      },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(categorias, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Error al obtener categorías de catálogo:", error);
    return NextResponse.json(
      { error: "Error al obtener categorías" },
      { status: 500 }
    );
  }
}
