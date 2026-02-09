import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const notification = await prisma.notification.create({
      data: {
        type: body.type,
        title: body.title,
        description: body.description,
        productoId: body.productoId ?? null,
        fingerprint: body.fingerprint,
      },
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    return NextResponse.json(
      { error: "Error creating notification" },
      { status: 400 }
    );
  }
}
