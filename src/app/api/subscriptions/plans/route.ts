import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const plans = await prisma.plan.findMany({
            orderBy: { id: 'asc' }
        });

        return NextResponse.json({ plans });
    } catch (error) {
        return NextResponse.json({ error: "No se pudieron obtener los planes" }, { status: 500 });
    }
}
