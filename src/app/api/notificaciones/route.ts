import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const onlyUnread = searchParams.get("onlyUnread") === "true";
    const limit = Number(searchParams.get("limit") || 50);

    const notifications = await prisma.notification.findMany({
      where: onlyUnread ? { read: false } : {},
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ data: notifications });
  } catch (error) {
    return NextResponse.json(
      { error: "Error fetching notifications" },
      { status: 500 }
    );
  }
}
