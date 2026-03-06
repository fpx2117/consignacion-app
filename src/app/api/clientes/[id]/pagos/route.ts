import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { createPagoSchema } from "@/lib/validators/cliente";

// Definimos la interfaz para Next.js 15+
interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteContext) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  // Resolvemos los params de forma asíncrona
  const { id: rawId } = await params;
  const clienteId = Number(rawId);

  if (!Number.isFinite(clienteId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createPagoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new Error("CLIENTE_NO_EXISTE");

    const pago = await tx.pago.create({
      data: {
        clienteId,
        sucursalId: auth.activeSucursalId, // <--- NUEVO
        tipo: "DEUDA",                     // <--- NUEVO
        monto: parsed.data.monto,
        metodo: parsed.data.metodo,
      },
    });

    const updated = await tx.cliente.update({
      where: { id: clienteId },
      data: { saldoCuenta: { decrement: parsed.data.monto } },
      select: { id: true, saldoCuenta: true },
    });

    return { pago, saldo: updated.saldoCuenta };
  }).catch((e) => {
    if (String(e?.message) === "CLIENTE_NO_EXISTE") return null;
    throw e;
  });

  if (!result) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ data: result }, { status: 201 });
}