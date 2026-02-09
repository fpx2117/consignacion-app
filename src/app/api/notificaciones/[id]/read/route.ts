import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);

    const notification = await prisma.notification.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 }
    );
  }
}
