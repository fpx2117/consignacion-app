import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";

type TiendaGlobalBody = {
    modoUnificado?: boolean;
};

export async function GET() {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const config = await prisma.tiendaGlobalConfig.findUnique({ where: { id: 1 } });

    return NextResponse.json({
        data: { modoUnificado: config?.modoUnificado ?? true },
    });
}

export async function PUT(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!requireRole(auth.user, ["ADMIN"])) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const { modoUnificado } = (await req.json()) as TiendaGlobalBody;

        if (modoUnificado === undefined || typeof modoUnificado !== "boolean") {
            return NextResponse.json({ error: "modoUnificado debe ser booleano" }, { status: 400 });
        }

        const config = await prisma.tiendaGlobalConfig.upsert({
            where: { id: 1 },
            update: { modoUnificado },
            create: { id: 1, modoUnificado },
        });

        revalidatePath("/lista");
        revalidateTag("public-catalog", "default");

        return NextResponse.json({ data: { modoUnificado: config.modoUnificado }, message: "Modo de tienda actualizado" });
    } catch (error) {
        console.error("Error actualizando tienda-global:", error);
        return NextResponse.json({ error: "Error al actualizar el modo de tienda" }, { status: 500 });
    }
}
