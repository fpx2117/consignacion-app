import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { recordAuditLog } from "@/lib/audit";

function hasErrorCode(error: unknown, code: string) {
    return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}

export async function GET() {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (auth.user.rol !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const sessions = await prisma.userSession.findMany({
            where: {
                isActive: true,
                expiresAt: { gt: new Date() },
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
                lastActivity: "desc",
            },
        });

        // ✅ Lazy creation: Si la conexión ACTUAL no tiene registro, lo creamos usando su token único
        const { getSessionHash } = await import("@/lib/security/session-hash");
        const currentUserId = parseInt(auth.user.sub);
        const currentSessionToken = getSessionHash(auth.token);
        const currentSession = sessions.find(s => s.token === currentSessionToken);

        if (!currentSession) {
            try {
                const { getRealClientData } = await import("@/lib/clientData");
                const clientData = await getRealClientData();

                const newSession = await prisma.userSession.create({
                    data: {
                        userId: currentUserId,
                        token: currentSessionToken,
                        userAgent: clientData.userAgent,
                        ipAddress: clientData.ip,
                        browser: clientData.browser,
                        os: clientData.os,
                        device: clientData.device,
                        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
                    },
                    include: {
                        user: { select: { nombre: true, email: true } }
                    }
                });

                sessions.push(newSession);
            } catch (lazyError: unknown) {
                // P2002 es error de duplicado en Prisma, significa que ya existe
                if (!hasErrorCode(lazyError, "P2002")) {
                    console.error("Lazy session creation failed:", lazyError);
                }
            }
        }

        return NextResponse.json({ ok: true, data: sessions });
    } catch (error: unknown) {
        console.error("Fetch sessions error:", error);
        return NextResponse.json({ error: "Error al obtener las sesiones" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (auth.user.rol !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("id");

    if (!sessionId) {
        return NextResponse.json({ error: "ID de sesión requerido" }, { status: 400 });
    }

    try {
        const session = await prisma.userSession.update({
            where: { id: sessionId },
            data: { isActive: false },
        });

        await recordAuditLog({
            userId: parseInt(auth.user.sub),
            action: "REVOKE_SESSION",
            module: "AUTH",
            details: { revokedSessionId: sessionId, revokedUserId: session.userId },
        });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        console.error("Revoke session error:", error);
        return NextResponse.json({ error: "Error al revocar la sesión" }, { status: 500 });
    }
}
