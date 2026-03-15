//src/app/api/pagos/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildSucursalWhere } from "@/lib/sucursalScope";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  const sucursalWhere = buildSucursalWhere(auth);

  const pagos = await prisma.pago.findMany({
    where: sucursalWhere,
    orderBy: { id: "desc" },
    include: { cliente: true },
    take: 200,
  });

  return NextResponse.json({ data: pagos });
}
