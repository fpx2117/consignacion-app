//src/app/api/pagos/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const pagos = await prisma.pago.findMany({
    orderBy: { id: "desc" },
    include: { cliente: true },
    take: 200,
  });

  return NextResponse.json({ data: pagos });
}
