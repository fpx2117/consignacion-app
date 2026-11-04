import { NextResponse } from "next/server";
import { MetodoPago } from "@prisma/client";
import { z } from "zod";

import { StockAuthorityError } from "@/modules/inventory/stock-authority";
import {
  CLIENT_SCOPE_MESSAGE,
  SaleDomainError,
  type RegisterSaleCommand,
  type SaleDomainErrorCode,
} from "@/modules/ventas/application/register-sale";
import { readRegisterSaleUseCase } from "@/modules/ventas/register-sale-switch";
import {
  applyPostCommit,
  registerSaleLegacy,
  registerSaleThroughApplication,
  type RegisterSaleOutcome,
} from "@/app/api/ventas/register-sale-handlers";
import {
  defaultVentasRouteDeps,
  type VentasRouteDeps,
} from "@/app/api/ventas/ventas-route-deps";

const createVentaSchema = z.object({
  clienteId: z.number().int().positive().optional().nullable(),
  descuentoGlobal: z.number().nonnegative().optional(),
  metodoPago: z.nativeEnum(MetodoPago).optional(),
  items: z
    .array(
      z.object({
        productoId: z.number().int().positive(),
        units: z.number().int().positive(),
        descuento: z.number().nonnegative().optional(),
      }),
    )
    .min(1),
});

/**
 * Rechazos de negocio del caso de uso. La sesión de caja es la única que no es
 * un conflicto de estado; ambos dispatches producen los mismos códigos.
 */
const DOMAIN_ERROR_STATUS: Record<SaleDomainErrorCode, number> = {
  CASH_SESSION_REQUIRED: 403,
  CLIENT_OUT_OF_SCOPE: 409,
  PRODUCT_NOT_IN_BRANCH: 409,
  INSUFFICIENT_STOCK: 409,
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "";
}

export async function GET() {
  return handleGetVentas();
}

export async function handleGetVentas(
  deps: VentasRouteDeps = defaultVentasRouteDeps,
) {
  const auth = await deps.requireAuth();
  if (!auth.ok) return auth.res;
  const sucursalWhere = deps.buildSucursalWhere(auth);

  const ventas = await deps.prisma.venta.findMany({
    where: sucursalWhere,
    orderBy: { id: "desc" },
    include: { cliente: true, detalles: { include: { producto: true } } },
    take: 200,
  });

  return NextResponse.json({ data: ventas });
}

export async function POST(req: Request) {
  return handlePostVenta(req);
}

export async function handlePostVenta(
  req: Request,
  deps: VentasRouteDeps = defaultVentasRouteDeps,
) {
  const auth = await deps.requireAuth();
  if (!auth.ok) return auth.res;
  if (deps.isGlobalSucursalView(auth)) {
    return NextResponse.json(
      {
        error:
          "Vista global en modo solo lectura. Selecciona una sucursal para registrar ventas.",
      },
      { status: 409 },
    );
  }

  const rawId = auth.user.sub;
  const usuarioId = Number(rawId);

  if (!rawId || isNaN(usuarioId)) {
    return NextResponse.json(
      { error: "Identificación de usuario fallida. Reingresa al sistema." },
      { status: 401 },
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const parsed = createVentaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validación fallida", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { clienteId, descuentoGlobal, items, metodoPago } = parsed.data;

    // Punto único de dispatch (ADR 006): se resuelve antes de cualquier efecto
    // durable y esta request ejecuta exactamente un handler. No hay fallback
    // entre ellos después de iniciar efectos.
    const selection = readRegisterSaleUseCase();

    const command: RegisterSaleCommand = {
      usuarioId,
      sucursalId: auth.activeSucursalId,
      clienteId: clienteId ?? null,
      paymentMethod: metodoPago ?? MetodoPago.EFECTIVO,
      globalDiscount: descuentoGlobal,
      items,
    };

    const outcome: RegisterSaleOutcome =
      selection.name === "application"
        ? await registerSaleThroughApplication(command, auth, deps)
        : await registerSaleLegacy(command, auth, deps);

    await applyPostCommit(outcome, auth.activeSucursalId, deps);

    return NextResponse.json({ data: outcome.sale, pago: outcome.payment });
  } catch (error) {
    // La caja cerrada es un rechazo esperado, no un error del servidor: se
    // responde sin registrarlo, igual que antes de la extracción.
    if (
      error instanceof SaleDomainError &&
      error.code === "CASH_SESSION_REQUIRED"
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: DOMAIN_ERROR_STATUS[error.code] },
      );
    }

    console.error("Error POS:", error);
    if (error instanceof StockAuthorityError) {
      console.error("Autoridad de stock rechazada:", error.code);
      return NextResponse.json(
        { error: "Autoridad de stock no disponible." },
        { status: 503 },
      );
    }
    if (error instanceof SaleDomainError) {
      return NextResponse.json(
        { error: error.message },
        { status: DOMAIN_ERROR_STATUS[error.code] },
      );
    }
    const msg = getErrorMessage(error);
    if (
      msg.includes("Stock insuficiente") ||
      msg.includes("no está asignado") ||
      msg.includes("Inconsistencia de stock") ||
      msg === CLIENT_SCOPE_MESSAGE
    ) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Error al procesar la venta" },
      { status: 500 },
    );
  }
}
