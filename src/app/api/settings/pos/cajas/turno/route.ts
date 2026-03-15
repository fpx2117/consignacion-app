import { MetodoPago } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import type { JwtPayloadUser } from "@/lib/auth/core";
import { nowAR, getDayOfWeekAR, getTimeStringAR } from "@/lib/utils-date";
import { getConfiguredTz } from "@/lib/get-configured-tz";

type AbrirTurnoBody = {
  cajaId?: number;
  montoInicial?: number;
};

type ExtenderTurnoBody = {
  minutos?: number;
};

type CerrarTurnoBody = {
  montoReal?: number;
  observaciones?: string | null;
};

type ValidacionHorario =
  | { permitido: false; error: string }
  | { permitido: true; horaFin: string };

function sumarMinutos(horaStr: string, minutosASumar: number) {
  const [horas, minutos] = horaStr.split(":").map(Number);
  const date = new Date();
  date.setHours(horas, minutos + minutosASumar, 0, 0);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function getUsuarioIdFuerte(userPayload: JwtPayloadUser) {
  const parsed = Number(userPayload.sub);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("ID de usuario no encontrado.");
  }
  return parsed;
}

async function validarHorarioLaboral(usuarioId: number, sucursalId: number): Promise<ValidacionHorario> {
  const tz = await getConfiguredTz(sucursalId);
  const ahora = nowAR(tz);
  const diaSemana = getDayOfWeekAR(ahora, tz);
  const horaActual = getTimeStringAR(ahora, tz);

  const horario = await prisma.horarioLaboral.findUnique({
    where: { usuarioId_diaSemana: { usuarioId, diaSemana } },
  });

  if (!horario || !horario.activo) {
    return { permitido: false, error: "No tienes un turno asignado para hoy." };
  }

  if (horaActual < horario.horaInicio) {
    return { permitido: false, error: `Tu turno inicia a las ${horario.horaInicio}.` };
  }

  if (horaActual > horario.horaFin) {
    return { permitido: false, error: `Tu turno finalizo a las ${horario.horaFin}.` };
  }

  return { permitido: true, horaFin: horario.horaFin };
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const usuarioId = getUsuarioIdFuerte(auth.user);

    const sesionAbierta = await prisma.sesionCaja.findFirst({
      where: { usuarioId, estado: "ABIERTA", caja: { sucursalId: auth.activeSucursalId } },
      include: {
        caja: true,
        ventas: { where: { tipo: "CASUAL" } },
        pagos: true,
        movimientos: true,
      },
    });

    const tzGet = await getConfiguredTz(auth.activeSucursalId);
    const ahora = nowAR(tzGet);
    const horarioHoy = await prisma.horarioLaboral.findUnique({
      where: { usuarioId_diaSemana: { usuarioId, diaSemana: getDayOfWeekAR(ahora, tzGet) } },
    });

    let horaFinCalculada = horarioHoy?.horaFin;

    if (sesionAbierta?.observaciones && horaFinCalculada) {
      const regex = /\[EXTENSI(?:ON|ÓN) (\d+)MIN/g;
      let totalMinutosExtra = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(sesionAbierta.observaciones)) !== null) {
        totalMinutosExtra += Number.parseInt(match[1], 10);
      }

      if (totalMinutosExtra > 0) {
        horaFinCalculada = sumarMinutos(horaFinCalculada, totalMinutosExtra);
      }
    }

    return NextResponse.json({
      data: sesionAbierta,
      horarioConfigurado: horarioHoy
        ? {
            ...horarioHoy,
            horaFin: horaFinCalculada,
          }
        : null,
    });
  } catch (error) {
    console.error("Error al obtener el turno activo:", error);
    return NextResponse.json({ error: "Error al obtener el turno activo" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const usuarioId = getUsuarioIdFuerte(auth.user);
    const { cajaId, montoInicial } = (await req.json()) as AbrirTurnoBody;
    const cajaIdNumerico = typeof cajaId === "number" ? cajaId : Number.NaN;
    const montoInicialNumerico = typeof montoInicial === "number" ? montoInicial : Number.NaN;

    if (!Number.isFinite(cajaIdNumerico) || !Number.isFinite(montoInicialNumerico)) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const verificacion = await validarHorarioLaboral(usuarioId, auth.activeSucursalId);
    if (!verificacion.permitido) {
      return NextResponse.json({ error: verificacion.error }, { status: 403 });
    }

    const cajaSelect = await prisma.caja.findUnique({ where: { id: cajaIdNumerico } });
    if (!cajaSelect || cajaSelect.sucursalId !== auth.activeSucursalId) {
      return NextResponse.json({ error: "Caja no valida para esta sucursal." }, { status: 403 });
    }

    const activa = await prisma.sesionCaja.findFirst({
      where: { usuarioId, estado: "ABIERTA" },
    });
    if (activa) {
      return NextResponse.json({ error: "Ya tienes una sesion abierta." }, { status: 403 });
    }

    const nueva = await prisma.sesionCaja.create({
      data: {
        cajaId: cajaIdNumerico,
        usuarioId,
        montoInicial: montoInicialNumerico,
        estado: "ABIERTA",
      },
    });

    return NextResponse.json({ data: nueva });
  } catch (error) {
    console.error("Error al abrir el turno de caja:", error);
    return NextResponse.json({ error: "Error al abrir el turno de caja" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const { minutos } = (await req.json()) as ExtenderTurnoBody;
    const usuarioId = getUsuarioIdFuerte(auth.user);
    const minutosExtra = typeof minutos === "number" ? minutos : Number.NaN;

    if (!Number.isFinite(minutosExtra) || minutosExtra <= 0) {
      return NextResponse.json({ error: "Minutos invalidos." }, { status: 400 });
    }

    const sesion = await prisma.sesionCaja.findFirst({
      where: { usuarioId, estado: "ABIERTA", caja: { sucursalId: auth.activeSucursalId } },
    });

    if (!sesion) {
      return NextResponse.json({ error: "No hay sesion para extender." }, { status: 404 });
    }

    const timeStamp = getTimeStringAR(nowAR());
    const tagExtension = `[EXTENSIÓN ${minutosExtra}MIN: ${timeStamp}]`;

    const actualizada = await prisma.sesionCaja.update({
      where: { id: sesion.id },
      data: {
        observaciones: sesion.observaciones
          ? `${sesion.observaciones} ${tagExtension}`
          : tagExtension,
      },
    });

    return NextResponse.json({ data: actualizada });
  } catch (error) {
    console.error("Error al extender el turno:", error);
    return NextResponse.json({ error: "Error al extender el turno" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const usuarioId = getUsuarioIdFuerte(auth.user);
    const { montoReal, observaciones } = (await req.json()) as CerrarTurnoBody;
    const montoRealNumerico = typeof montoReal === "number" ? montoReal : Number.NaN;

    if (!Number.isFinite(montoRealNumerico)) {
      return NextResponse.json({ error: "Monto real invalido." }, { status: 400 });
    }

    const sesion = await prisma.sesionCaja.findFirst({
      where: { usuarioId, estado: "ABIERTA", caja: { sucursalId: auth.activeSucursalId } },
      include: {
        ventas: { where: { tipo: "CASUAL" } },
        pagos: true,
        movimientos: true,
      },
    });

    if (!sesion) {
      return NextResponse.json({ error: "Caja no encontrada." }, { status: 404 });
    }

    let esperado = Number(sesion.montoInicial);
    const ventasEfectivo = sesion.ventas
      .filter((venta) => venta.metodoPago === MetodoPago.EFECTIVO)
      .reduce((total, venta) => total + Number(venta.total), 0);
    const cobranzasEfectivo = sesion.pagos
      .filter((pago) => pago.metodo === MetodoPago.EFECTIVO)
      .reduce((total, pago) => total + Number(pago.monto), 0);
    const ingresos = sesion.movimientos
      .filter((movimiento) => movimiento.tipo === "INGRESO")
      .reduce((total, movimiento) => total + Number(movimiento.monto), 0);
    const egresos = sesion.movimientos
      .filter((movimiento) => movimiento.tipo === "EGRESO")
      .reduce((total, movimiento) => total + Number(movimiento.monto), 0);

    esperado = esperado + ventasEfectivo + cobranzasEfectivo + ingresos - egresos;
    const diferencia = montoRealNumerico - esperado;
    const observacionesCierre = observaciones?.trim();
    const observacionesFinales = [sesion.observaciones?.trim(), observacionesCierre ? `Cierre: ${observacionesCierre}` : null]
      .filter(Boolean)
      .join(" | ");

    const cerrada = await prisma.sesionCaja.update({
      where: { id: sesion.id },
      data: {
        estado: "CERRADA",
        fechaCierre: nowAR(),
        montoFinalEsperado: esperado,
        montoFinalReal: montoRealNumerico,
        diferencia,
        observaciones: observacionesFinales || null,
      },
    });

    return NextResponse.json({
      message: "Caja cerrada correctamente",
      data: cerrada,
      extra: { esperadoEfectivo: esperado },
    });
  } catch (error) {
    console.error("Error al cerrar la caja:", error);
    return NextResponse.json({ error: "Error al cerrar la caja" }, { status: 500 });
  }
}
