import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH() {
  try {
    await prisma.notification.updateMany({
      where: { read: false },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Error marking all as read" },
      { status: 500 }
    );
  }
}
