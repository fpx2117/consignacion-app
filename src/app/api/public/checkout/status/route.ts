import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type CheckoutIntentStatus =
  "INITIATED" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED";
type PublicCheckoutStatus = "PENDING" | "PAID" | "FAILED";

type CheckoutIntentStatusRow = {
  status: CheckoutIntentStatus;
  ventaId: number | null;
  failureReason: string | null;
};

type CheckoutIntentStatusClient = {
  findUnique: (args: {
    where: { externalReference: string };
    select: { status: true; ventaId: true; failureReason: true };
  }) => Promise<CheckoutIntentStatusRow | null>;
};

type PublicCheckoutStatusResponse = {
  status: PublicCheckoutStatus;
  ventaId?: number;
  reason?: string;
};

const TOKEN_PATTERN = /^chk_[a-zA-Z0-9]+$/;

function toPublicStatus(
  intent: CheckoutIntentStatusRow,
): PublicCheckoutStatusResponse {
  if (intent.status === "PAID") {
    return {
      status: "PAID",
      ...(typeof intent.ventaId === "number"
        ? { ventaId: intent.ventaId }
        : {}),
    };
  }

  if (
    intent.status === "FAILED" ||
    intent.status === "CANCELLED" ||
    intent.status === "EXPIRED"
  ) {
    return {
      status: "FAILED",
      ...(intent.failureReason ? { reason: intent.failureReason } : {}),
    };
  }

  return { status: "PENDING" };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tokenParam = searchParams.get("token");

  if (tokenParam === null) {
    return NextResponse.json(
      { error: "Falta el parámetro token" },
      { status: 400 },
    );
  }

  const token = tokenParam.trim();
  if (!token || !TOKEN_PATTERN.test(token)) {
    return NextResponse.json(
      { error: "El token es inválido" },
      { status: 400 },
    );
  }

  try {
    const checkoutIntentDb = (
      prisma as unknown as { checkoutIntent: CheckoutIntentStatusClient }
    ).checkoutIntent;
    const intent = await checkoutIntentDb.findUnique({
      where: { externalReference: token },
      select: { status: true, ventaId: true, failureReason: true },
    });

    if (!intent) {
      return NextResponse.json(
        { error: "No se encontró un checkout para el token indicado" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: toPublicStatus(intent) });
  } catch (error) {
    console.error("Error public checkout status:", error);
    return NextResponse.json(
      { error: "Error al consultar el estado del checkout" },
      { status: 500 },
    );
  }
}
