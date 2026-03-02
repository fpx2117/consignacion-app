// src/app/api/upload/route.ts

import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAuth, requireRole } from "@/lib/requireAuth";

export async function POST(req: Request) {
    try {
        const auth = await requireAuth();
        if (!auth.ok) return auth.res;

        if (!requireRole(auth.user, ["ADMIN"])) {
            return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Definir la ruta de destino
        const uploadDir = path.join(process.cwd(), "public", "uploads");

        // Asegurarse de que el directorio exista (por si acaso)
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (e) { }

        // Generar nombre de archivo único
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase();
        const filename = `${timestamp}-${sanitizedName}`;
        const filePath = path.join(uploadDir, filename);

        // Escribir el archivo
        await writeFile(filePath, buffer);

        // Devolver la URL pública
        const url = `/uploads/${filename}`;

        return NextResponse.json({
            success: true,
            url: url,
            filename: filename
        });

    } catch (error) {
        console.error("Error en upload:", error);
        return NextResponse.json(
            { error: "Error interno al subir el archivo" },
            { status: 500 }
        );
    }
}
