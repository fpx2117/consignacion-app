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

  // ✅ token generado en el servidor
  const token = generatePdfToken(id);

  // ⚠️ Ajustá el path según tu ruta real:
  // Si tu PDF está en /ticket/[id]
  const url = `/ticket/${id}?token=${encodeURIComponent(token)}`;

  return NextResponse.json({ url });
}
