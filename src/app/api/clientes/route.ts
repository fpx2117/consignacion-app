import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { createClienteSchema } from "@/lib/validators/cliente";
import { buildSucursalWhere, isGlobalSucursalView } from "@/lib/sucursalScope";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const clientes = await prisma.cliente.findMany({
    where: buildSucursalWhere(auth),
    orderBy: { id: "desc" }
  });
  return NextResponse.json({ data: clientes });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para crear clientes." }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createClienteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await prisma.cliente.create({
    data: {
      nombre: parsed.data.nombre,
      telefono: parsed.data.telefono ?? null,
      direccion: parsed.data.direccion ?? null,
      saldoCuenta: 0,
      sucursalId: auth.activeSucursalId,
    },
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
