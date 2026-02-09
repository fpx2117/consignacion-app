import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      pagos: { orderBy: { fecha: "desc" }, take: 50 },
      ventas: { orderBy: { fecha: "desc" }, take: 50, include: { detalles: true } },
    },
  });

  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

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
