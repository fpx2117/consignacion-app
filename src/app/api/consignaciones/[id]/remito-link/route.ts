
//src/app/api/consignaciones/[id]/remito-link/route.ts
import { NextResponse } from "next/server";
import { generatePdfToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> } // ✅ así lo exige tu build
) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // ✅ token generado SIEMPRE en servidor
  const token = generatePdfToken(id);

  // ✅ importante: token encodeado
  const url = `/ver/remito/${id}?token=${encodeURIComponent(token)}`;

  // ✅ respuesta simple
  return NextResponse.json({ url }, { status: 200 });
}
