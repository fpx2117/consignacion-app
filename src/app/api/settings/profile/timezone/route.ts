import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { isValidTimezone, resolveTimezoneForAuth } from "@/lib/timezone/get-configured-tz";

const updateProfileTimezoneSchema = z.object({
  zonaHoraria: z.string().trim().min(1).nullable(),
});

function buildTimezoneResponse(timezone: Awaited<ReturnType<typeof resolveTimezoneForAuth>>) {
  return {
    zonaHoraria: timezone.zonaHorariaUsuario,
    zonaHorariaSucursal: timezone.zonaHorariaSucursal,
    zonaHorariaResuelta: timezone.tz,
    timezoneSource: timezone.source,
  };
}

type ProfileTimezoneRouteDeps = {
  requireAuth: typeof requireAuth;
  resolveTimezoneForAuth: typeof resolveTimezoneForAuth;
  updateUserTimezone: (input: { userId: number; zonaHoraria: string | null }) => Promise<void>;
  isValidTimezone: typeof isValidTimezone;
};

const defaultDeps: ProfileTimezoneRouteDeps = {
  requireAuth,
  resolveTimezoneForAuth,
  updateUserTimezone: async ({ userId, zonaHoraria }) => {
    await prisma.usuario.update({
      where: { id: userId },
      data: { zonaHoraria },
    });
  },
  isValidTimezone,
};

export async function handleGetProfileTimezone(deps: ProfileTimezoneRouteDeps = defaultDeps) {
  const auth = await deps.requireAuth();
  if (!auth.ok) return auth.res;

  const timezone = await deps.resolveTimezoneForAuth(auth);
  return NextResponse.json({ data: buildTimezoneResponse(timezone) });
}

export async function handlePutProfileTimezone(req: Request, deps: ProfileTimezoneRouteDeps = defaultDeps) {
  const auth = await deps.requireAuth();
  if (!auth.ok) return auth.res;

  const userId = Number(auth.user.sub);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  try {
    const parsed = updateProfileTimezoneSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const { zonaHoraria } = parsed.data;

    if (zonaHoraria !== null && !deps.isValidTimezone(zonaHoraria)) {
      return NextResponse.json(
        { error: `Zona horaria inválida: "${zonaHoraria}" no es una timezone IANA válida.` },
        { status: 400 },
      );
    }

    await deps.updateUserTimezone({ userId, zonaHoraria });

    const timezone = await deps.resolveTimezoneForAuth(auth);
    return NextResponse.json({
      data: buildTimezoneResponse(timezone),
      message: zonaHoraria
        ? "Zona horaria personal actualizada"
        : "Se volvió a heredar la zona horaria de sucursal",
    });
  } catch (error) {
    console.error("Error actualizando la zona horaria personal:", error);
    return NextResponse.json({ error: "Error al actualizar la zona horaria personal" }, { status: 500 });
  }
}

export async function GET() {
  return handleGetProfileTimezone();
}

export async function PUT(req: Request) {
  return handlePutProfileTimezone(req);
}
