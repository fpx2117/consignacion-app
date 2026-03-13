import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { buildSucursalWhere } from "@/lib/sucursalScope";

// Definimos la interfaz para los params como una Promesa
interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: RouteContext) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  // Resolvemos la promesa de params antes de usar el ID
  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const sucursalWhere = buildSucursalWhere(auth);
  const pagosWhere = Object.keys(sucursalWhere).length > 0 ? sucursalWhere : undefined;
  const ventasWhere = Object.keys(sucursalWhere).length > 0 ? sucursalWhere : undefined;

  const cliente = await prisma.cliente.findFirst({
    where: { id, ...sucursalWhere },
    include: {
      pagos: {
        where: pagosWhere,
        orderBy: { fecha: "desc" },
        take: 50,
      },
      ventas: {
        where: ventasWhere,
        orderBy: { fecha: "desc" },
        take: 50,
        include: { detalles: true },
      },
    },
  });

  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: cliente.id,
      nombre: cliente.nombre,
      saldoCuenta: cliente.saldoCuenta,
      ventas: cliente.ventas,
      pagos: cliente.pagos,
    },
  });
}
