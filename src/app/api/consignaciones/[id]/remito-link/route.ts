import { NextRequest, NextResponse } from "next/server";
import { generatePdfToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ así lo exige tu build
) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const token = generatePdfToken(id);
  const url = `/ver/remito/${id}?token=${encodeURIComponent(token)}`;

  return NextResponse.json({ url });
}
