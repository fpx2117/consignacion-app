// src/app/api/gastos/[id]/comprobante-link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortCode, hashCode, encryptCode, decryptCode } from "@/lib/share-links";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { id: idParam } = await params;
    const id = Number(idParam);

    if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    // Reuse existing valid link
    const existing = await prisma.shareLink.findFirst({
        where: {
            type: "COMPROBANTE_GASTO",
            targetId: id,
            expiresAt: { gt: new Date() },
            views: { lt: 20 },
        },
        orderBy: { createdAt: "desc" },
    });

    if (existing) {
        return NextResponse.json({ url: `/x/${decryptCode(existing.codeEnc)}` });
    }

    const code = generateShortCode(8);
    await prisma.shareLink.create({
        data: {
            codeHash: hashCode(code),
            codeEnc: encryptCode(code),
            type: "COMPROBANTE_GASTO",
            targetId: id,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
            maxViews: 20,
        },
    });

    return NextResponse.json({ url: `/x/${code}` });
}
