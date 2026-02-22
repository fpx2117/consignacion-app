import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const userCount = await prisma.usuario.count();

        return NextResponse.json({
            initialized: userCount > 0,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error checking setup status:", error);
        return NextResponse.json(
            { error: "Error checking setup status", initialized: true }, // Safety fallback
            { status: 500 }
        );
    }
}
