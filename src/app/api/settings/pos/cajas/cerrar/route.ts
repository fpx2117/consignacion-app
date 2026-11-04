import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { nowAR } from "@/lib/date-format/utils-date";
import { resolveTimezoneForAuth } from "@/lib/timezone/get-configured-tz";

type CerrarCajaBody = {
  sesionId?: number;
  montoReal?: number;
  observaciones?: string | null;
};

const SESION_NO_ABIERTA = "SESION_NO_ABIERTA";
const SESION_NO_ABIERTA_RESPONSE = {
  error: "Sesion no encontrada o ya cerrada.",
} as const;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const { sesionId, montoReal, observaciones } =
      (await req.json()) as CerrarCajaBody;
    const sesionCajaId = typeof sesionId === "number" ? sesionId : Number.NaN;
    const montoRealNumerico =
      typeof montoReal === "number" ? montoReal : Number.NaN;

    if (!Number.isFinite(sesionCajaId) || !Number.isFinite(montoRealNumerico)) {
      return NextResponse.json(
        { error: "Datos invalidos para cerrar la caja." },
        { status: 400 },
      );
    }

    const timezone = await resolveTimezoneForAuth(auth);

    // T22: lock, lectura, cálculo y cierre en una sola transacción. Si la suma
    // ocurriera fuera, una venta podría confirmarse entre el total y el cierre y
    // quedar fuera de `montoFinalEsperado`; y dos cierres concurrentes podrían
    // pisarse con totales distintos.
    const sesionCerrada = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT s."id" FROM public."SesionCaja" s
        JOIN public."Caja" c ON c."id" = s."cajaId"
        WHERE s."id" = ${sesionCajaId}
          AND c."sucursalId" = ${auth.activeSucursalId}
        LIMIT 1
        FOR UPDATE OF s
      `;
      if (locked.length === 0) throw new Error(SESION_NO_ABIERTA);

      const sesion = await tx.sesionCaja.findUnique({
        where: { id: sesionCajaId },
        include: {
          ventas: { where: { tipo: "CASUAL" } },
          movimientos: true,
        },
      });
      if (!sesion || sesion.estado === "CERRADA") {
        throw new Error(SESION_NO_ABIERTA);
      }

      const totalVentas = sesion.ventas.reduce(
        (acc, venta) => acc + Number(venta.total),
        0,
      );
      const totalIngresos = sesion.movimientos
        .filter((movimiento) => movimiento.tipo === "INGRESO")
        .reduce((acc, movimiento) => acc + Number(movimiento.monto), 0);
      const totalEgresos = sesion.movimientos
        .filter((movimiento) => movimiento.tipo === "EGRESO")
        .reduce((acc, movimiento) => acc + Number(movimiento.monto), 0);

      const montoEsperado =
        Number(sesion.montoInicial) + totalVentas + totalIngresos - totalEgresos;
      const diferencia = montoRealNumerico - montoEsperado;

      const claimed = await tx.sesionCaja.updateMany({
        where: { id: sesionCajaId, estado: "ABIERTA" },
        data: {
          estado: "CERRADA",
          fechaCierre: nowAR(timezone.tz),
          montoFinalEsperado: montoEsperado,
          montoFinalReal: montoRealNumerico,
          diferencia,
          observaciones: observaciones ?? null,
        },
      });
      if (claimed.count !== 1) throw new Error(SESION_NO_ABIERTA);

      return tx.sesionCaja.findUniqueOrThrow({ where: { id: sesionCajaId } });
    });

    return NextResponse.json({ data: sesionCerrada });
  } catch (error) {
    if (error instanceof Error && error.message === SESION_NO_ABIERTA) {
      return NextResponse.json(SESION_NO_ABIERTA_RESPONSE, { status: 400 });
    }
    console.error("Error al cerrar la caja:", error);
    return NextResponse.json(
      { error: "Error al cerrar la caja" },
      { status: 500 },
    );
  }
}
