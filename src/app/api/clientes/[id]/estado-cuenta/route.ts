import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

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

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      pagos: { orderBy: { fecha: "desc" }, take: 50 },
      ventas: { 
        orderBy: { fecha: "desc" }, 
        take: 50, 
        include: { detalles: true } 
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