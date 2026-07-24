// src/app/api/pagos/[clienteId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { createPagoSchema } from "@/lib/validators/cliente";
import { isGlobalSucursalView } from "@/lib/security/sucursalScope";

interface RouteContext {
  params: Promise<{ clienteId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      {
        error:
          "Vista global en modo solo lectura. Selecciona una sucursal para registrar pagos.",
      },
      { status: 409 },
    );
  }

  const usuarioId = Number(auth.user.sub);

  try {
    const { clienteId: clienteIdStr } = await params;
    const clienteId = Number(clienteIdStr);

    if (!Number.isFinite(clienteId)) {
      return NextResponse.json(
        { error: "ID de cliente invalido" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = createPagoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validacion fallida", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const sesionActiva = await prisma.sesionCaja.findFirst({
      where: {
        usuarioId,
        estado: "ABIERTA",
        caja: { sucursalId: auth.activeSucursalId },
      },
      select: { id: true },
    });

    if (!sesionActiva) {
      return NextResponse.json(
        { error: "No puedes cobrar pagos sin abrir tu turno de caja primero." },
        { status: 403 },
      );
    }

    const result = await prisma
      .$transaction(async (tx) => {
        const cliente = await tx.cliente.findFirst({
          where: { id: clienteId, sucursalId: auth.activeSucursalId },
          select: { id: true },
        });

        if (!cliente) {
          throw new Error("CLIENTE_NO_ENCONTRADO");
        }

        const nuevoPago = await tx.pago.create({
          data: {
            clienteId,
            sucursalId: auth.activeSucursalId,
            tipo: "DEUDA",
            monto: parsed.data.monto,
            metodo: parsed.data.metodo,
            sesionCajaId: sesionActiva.id,
          },
        });

        const clienteActualizado = await tx.cliente.update({
          where: { id: clienteId },
          data: { saldoCuenta: { decrement: parsed.data.monto } },
          select: { saldoCuenta: true },
        });

        return { pago: nuevoPago, saldo: clienteActualizado.saldoCuenta };
      })
      .catch((error: unknown) => {
        if (
          error instanceof Error &&
          error.message === "CLIENTE_NO_ENCONTRADO"
        ) {
          return null;
        }

        throw error;
      });

    if (!result) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("Error al registrar pago:", error);
    return NextResponse.json(
      { error: "Error al registrar el pago" },
      { status: 500 },
    );
  }
}
