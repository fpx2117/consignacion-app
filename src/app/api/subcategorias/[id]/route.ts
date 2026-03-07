/* eslint-disable */
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: rawId } = await params;
        const id = parseInt(rawId, 10);
        const body = await req.json();
        const { nombre, descuentos } = body;

        if (!nombre) {
            return NextResponse.json(
                { error: "El nombre es obligatorio" },
                { status: 400 }
            );
        }

        const subcategoria = await prisma.subcategoria.update({
            where: { id },
            data: {
                nombre: nombre?.trim(),
                ...(descuentos !== undefined && { descuentos })
            },
        });

        return NextResponse.json(subcategoria);
    } catch (error) {
        return NextResponse.json(
            { error: "Error al actualizar la subcategoría" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: rawId } = await params;
        const id = parseInt(rawId, 10);

        // Los productos asociados quedarán con subcategoriaId = null por defecto de Prisma
        // o podemos hacerlo explícito si queremos. 
        // En el esquema no pusimos onDelete: SetNull, por defecto Prisma no lo hace si no se especifica.
        // Pero como es opcional (Int?), podemos borrarla y Prisma debería permitirlo si no hay FK restrictiva.

        await prisma.subcategoria.delete({
            where: { id },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Delete subcategory error:", error);
        return NextResponse.json(
            { error: "Error al eliminar la subcategoría" },
            { status: 500 }
        );
    }
}
