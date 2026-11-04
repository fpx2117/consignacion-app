// src/app/api/pagos/[clienteId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { createPagoSchema } from "@/lib/validators/cliente";
import { isGlobalSucursalView } from "@/lib/security/sucursalScope";

const IDEMPOTENCY_HEADER = "idempotency-key";
const MAX_IDEMPOTENCY_KEY = 120;
const CLIENTE_NO_ENCONTRADO = "CLIENTE_NO_ENCONTRADO";

interface RouteContext {
  params: Promise<{ clienteId: string }>;
}

type PagoRouteDeps = {
  prisma: typeof prisma;
  requireAuth: typeof requireAuth;
  isGlobalSucursalView: typeof isGlobalSucursalView;
};

const defaultDeps: PagoRouteDeps = {
  prisma,
  requireAuth,
  isGlobalSucursalView,
};

/**
 * Un reintento con la misma clave devuelve el pago ya creado en lugar de
 * registrar otro y volver a descontar el saldo. La transacción que choca con el
 * índice único se revierte entera, así que el `decrement` no se aplica dos veces.
 */
function isIdempotencyConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function POST(req: NextRequest, context: RouteContext) {
  return handlePostPago(req, context);
}

export async function handlePostPago(
  req: NextRequest,
  { params }: RouteContext,
  deps: PagoRouteDeps = defaultDeps,
) {
  const auth = await deps.requireAuth();
  if (!auth.ok) return auth.res;
  if (deps.isGlobalSucursalView(auth)) {
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

    const rawIdempotencyKey = req.headers.get(IDEMPOTENCY_HEADER);
    const idempotencyKey = rawIdempotencyKey?.trim() ?? null;
    if (
      idempotencyKey !== null &&
      (idempotencyKey.length === 0 ||
        idempotencyKey.length > MAX_IDEMPOTENCY_KEY)
    ) {
      return NextResponse.json(
        { error: "Idempotency-Key invalida" },
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

    const sesionActiva = await deps.prisma.sesionCaja.findFirst({
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

    try {
      const result = await deps.prisma.$transaction(async (tx) => {
        const cliente = await tx.cliente.findFirst({
          where: { id: clienteId, sucursalId: auth.activeSucursalId },
          select: { id: true },
        });

        if (!cliente) {
          throw new Error(CLIENTE_NO_ENCONTRADO);
        }

        const nuevoPago = await tx.pago.create({
          data: {
            clienteId,
            sucursalId: auth.activeSucursalId,
            tipo: "DEUDA",
            monto: parsed.data.monto,
            metodo: parsed.data.metodo,
            sesionCajaId: sesionActiva.id,
            idempotencyKey,
          },
        });

        const clienteActualizado = await tx.cliente.update({
          where: { id: clienteId },
          data: { saldoCuenta: { decrement: parsed.data.monto } },
          select: { saldoCuenta: true },
        });

        return { pago: nuevoPago, saldo: clienteActualizado.saldoCuenta };
      });

      return NextResponse.json({ data: result }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === CLIENTE_NO_ENCONTRADO) {
        return NextResponse.json(
          { error: "Cliente no encontrado" },
          { status: 404 },
        );
      }

      if (idempotencyKey && isIdempotencyConflict(error)) {
        const [existing, cliente] = await Promise.all([
          deps.prisma.pago.findUnique({ where: { idempotencyKey } }),
          deps.prisma.cliente.findUnique({
            where: { id: clienteId },
            select: { saldoCuenta: true },
          }),
        ]);
        if (existing) {
          return NextResponse.json(
            { data: { pago: existing, saldo: cliente?.saldoCuenta ?? null } },
            { status: 200 },
          );
        }
      }

      throw error;
    }
  } catch (error) {
    console.error("Error al registrar pago:", error);
    return NextResponse.json(
      { error: "Error al registrar el pago" },
      { status: 500 },
    );
  }
}
