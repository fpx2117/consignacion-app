import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";

type CerrarCajaBody = {
  sesionId?: number;
  montoReal?: number;
  observaciones?: string | null;
};

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const { sesionId, montoReal, observaciones } = (await req.json()) as CerrarCajaBody;
    const sesionCajaId = typeof sesionId === "number" ? sesionId : Number.NaN;
    const montoRealNumerico = typeof montoReal === "number" ? montoReal : Number.NaN;

    if (!Number.isFinite(sesionCajaId) || !Number.isFinite(montoRealNumerico)) {
      return NextResponse.json({ error: "Datos invalidos para cerrar la caja." }, { status: 400 });
    }

    const sesion = await prisma.sesionCaja.findFirst({
      where: {
        id: sesionCajaId,
        caja: { sucursalId: auth.activeSucursalId },
      },
      include: {
        ventas: { where: { tipo: "CASUAL" } },
        movimientos: true,
      },
    });

    if (!sesion || sesion.estado === "CERRADA") {
      return NextResponse.json({ error: "Sesion no encontrada o ya cerrada." }, { status: 400 });
    }

    const totalVentas = sesion.ventas.reduce((acc, venta) => acc + Number(venta.total), 0);
    const totalIngresos = sesion.movimientos
      .filter((movimiento) => movimiento.tipo === "INGRESO")
      .reduce((acc, movimiento) => acc + Number(movimiento.monto), 0);
    const totalEgresos = sesion.movimientos
      .filter((movimiento) => movimiento.tipo === "EGRESO")
      .reduce((acc, movimiento) => acc + Number(movimiento.monto), 0);

    const montoEsperado = Number(sesion.montoInicial) + totalVentas + totalIngresos - totalEgresos;
    const diferencia = montoRealNumerico - montoEsperado;

    const sesionCerrada = await prisma.sesionCaja.update({
      where: { id: sesionCajaId },
      data: {
        estado: "CERRADA",
        fechaCierre: new Date(),
        montoFinalEsperado: montoEsperado,
        montoFinalReal: montoRealNumerico,
        diferencia,
        observaciones: observaciones ?? null,
      },
    });

    return NextResponse.json({ data: sesionCerrada });
  } catch (error) {
    console.error("Error al cerrar la caja:", error);
    return NextResponse.json({ error: "Error al cerrar la caja" }, { status: 500 });
  }
}
