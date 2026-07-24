import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";

type HorarioInput = {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
};

type HorariosBody = {
  usuarioId?: number;
  horarios?: HorarioInput[];
};

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const usuarios = await prisma.usuario.findMany({
      include: { horarios: true },
      where: { activo: true },
    });
    return NextResponse.json({ data: usuarios });
  } catch (error) {
    console.error("Error al obtener los horarios:", error);
    return NextResponse.json(
      { error: "Error al obtener los horarios" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { usuarioId, horarios } = (await req.json()) as HorariosBody;

    if (typeof usuarioId !== "number" || !Array.isArray(horarios)) {
      return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
    }

    for (const horario of horarios) {
      await prisma.horarioLaboral.upsert({
        where: {
          usuarioId_diaSemana: { usuarioId, diaSemana: horario.diaSemana },
        },
        update: {
          horaInicio: horario.horaInicio,
          horaFin: horario.horaFin,
          activo: horario.activo,
        },
        create: {
          usuarioId,
          diaSemana: horario.diaSemana,
          horaInicio: horario.horaInicio,
          horaFin: horario.horaFin,
          activo: horario.activo,
        },
      });
    }

    return NextResponse.json({ message: "Horarios actualizados" });
  } catch (error) {
    console.error("Error al actualizar los horarios:", error);
    return NextResponse.json(
      { error: "Error al actualizar los horarios" },
      { status: 500 },
    );
  }
}
