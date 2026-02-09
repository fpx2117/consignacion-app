import { NextResponse } from "next/server";
import { generatePdfToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const token = generatePdfToken(id);

  // Ajustá este path según tu ruta real:
  // Si tu remito está en /ver/remito/[id], dejalo así:
  const url = `/ver/remito/${id}?token=${encodeURIComponent(token)}`;

  return NextResponse.json({ url });
}
