import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import { canAccessSucursalId } from "@/lib/sucursalScope";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  // Solo ADMIN puede cambiar de sucursal
  if (auth.user.rol !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden cambiar de sucursal" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const sucursalId = Number(body?.sucursalId);

  if (!Number.isFinite(sucursalId) || sucursalId < 0) {
    return NextResponse.json(
      { error: "sucursalId inválido" },
      { status: 400 }
    );
  }

  // Vista global (id=0) — solo ADMIN
  if (sucursalId === 0) {
    const response = NextResponse.json({ ok: true, activeSucursalId: 0 });
    response.cookies.set("active_sucursal_id", "0", {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
    });
    return response;
  }

  if (!canAccessSucursalId(auth, sucursalId)) {
    return NextResponse.json(
      { error: "Sucursal no autorizada" },
      { status: 403 }
    );
  }

  // Verificar que la sucursal existe y está activa
  const sucursal = await prisma.sucursal.findFirst({
    where: { id: sucursalId, activa: true },
    select: { id: true },
  });

  if (!sucursal) {
    return NextResponse.json(
      { error: "Sucursal no encontrada o inactiva" },
      { status: 404 }
    );
  }

  const response = NextResponse.json({
    ok: true,
    activeSucursalId: sucursalId,
  });
  response.cookies.set("active_sucursal_id", String(sucursalId), {
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
    sameSite: "lax",
  });

  return response;
}
