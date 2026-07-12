import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";

type RouteContext = { params: Promise<{ id: string }> };

type UpdateSucursalBody = {
  nombre?: string;
  activa?: boolean;
  incluidaEnDashboardGlobal?: boolean;
};

function parseSucursalId(id: string) {
  const sucursalId = Number.parseInt(id, 10);
  return Number.isNaN(sucursalId) ? null : sucursalId;
}

export async function PUT(req: Request, { params }: RouteContext) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const sucursalId = parseSucursalId(id);

    if (sucursalId === null) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const { nombre, activa, incluidaEnDashboardGlobal } = (await req.json()) as UpdateSucursalBody;
    const existing = await prisma.sucursal.findUnique({ where: { id: sucursalId } });

    if (!existing) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
    }

    if (existing.esPrincipal && activa === false) {
      return NextResponse.json({ error: "No se puede desactivar la Sede Principal." }, { status: 400 });
    }

    const updated = await prisma.sucursal.update({
      where: { id: sucursalId },
      data: {
        ...(nombre !== undefined ? { nombre: nombre.trim() } : {}),
        ...(activa !== undefined ? { activa } : {}),
        ...(incluidaEnDashboardGlobal !== undefined ? { incluidaEnDashboardGlobal } : {}),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error al actualizar la sucursal:", error);
    return NextResponse.json({ error: "Error al actualizar la sucursal" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const sucursalId = parseSucursalId(id);

    if (sucursalId === null) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const existing = await prisma.sucursal.findUnique({
      where: { id: sucursalId },
      include: {
        _count: {
          select: {
            usuarios: true,
            ventas: true,
            consignaciones: true,
            stockProductos: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
    }

    if (existing.esPrincipal) {
      return NextResponse.json({ error: "La Sede Principal no puede ser eliminada." }, { status: 400 });
    }

    const hasRelations =
      existing._count.usuarios > 0 ||
      existing._count.ventas > 0 ||
      existing._count.consignaciones > 0 ||
      existing._count.stockProductos > 0;

    if (hasRelations) {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar la sucursal porque tiene datos asociados (usuarios, ventas o stock). Te recomendamos desactivarla en su lugar.",
        },
        { status: 400 }
      );
    }

    await prisma.sucursal.delete({ where: { id: sucursalId } });

    return NextResponse.json({ message: "Sucursal eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar la sucursal:", error);
    return NextResponse.json(
      { error: "Error al eliminar la sucursal. Verifique que no tenga datos vinculados." },
      { status: 500 }
    );
  }
}
