import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok || auth.user.rol !== "ADMIN") {
        return auth.res || NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const module = searchParams.get("module") || undefined;
    const userId = searchParams.get("userId") ? parseInt(searchParams.get("userId")!) : undefined;

    try {
        const logs = await prisma.auditLog.findMany({
            where: {
                module,
                userId,
            },
            include: {
                user: {
                    select: {
                        nombre: true,
                        email: true,
                    }
                }
            },
            orderBy: {
                createdAt: "desc",
            },
            take: limit,
        });

        return NextResponse.json({ ok: true, data: logs });
    } catch (error: any) {
        console.error("Fetch audit logs error:", error);
        return NextResponse.json({ error: error.message || "Error al obtener registros" }, { status: 500 });
    }
}
