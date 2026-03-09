
//src/app/api/liquidaciones/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const clienteIdRaw = searchParams.get("clienteId");
  const clienteId = clienteIdRaw ? Number(clienteIdRaw) : null;

  if (clienteIdRaw && !Number.isFinite(clienteId)) {
    return NextResponse.json({ error: "clienteId inválido" }, { status: 400 });
  }

  try {
    const where: any = {
      consignacion: {
        sucursalId: auth.activeSucursalId,
        ...(clienteId ? { clienteId } : {}),
      },
    };

    const liquidaciones = await prisma.liquidacion.findMany({
      where,
      take: 50,
      orderBy: { fecha: "desc" },
      include: {
        consignacion: { include: { cliente: { select: { nombre: true } } } },
        items: true,
        venta: true,
      },
    });

    return NextResponse.json({ data: liquidaciones });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al listar liquidaciones" }, { status: 500 });
  }
}

// ❗️POST /api/liquidaciones (general) lo saco para evitar confusión.
// La creación “por consignación” va en /api/liquidaciones/consignacion/[consignacionId]
