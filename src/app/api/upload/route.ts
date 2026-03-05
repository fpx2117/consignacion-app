/* eslint-disable */
// @ts-nocheck
// src/app/api/upload/route.ts

import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAuth, requireRole } from "@/lib/requireAuth";

// En Railway: UPLOAD_DIR=/app/uploads (volumen persistente montado)
// En local:   guarda en public/uploads (servido estático por Next.js)
const UPLOAD_DIR = process.env.UPLOAD_DIR
    ? process.env.UPLOAD_DIR
    : path.join(process.cwd(), "public", "uploads");

// Si hay UPLOAD_DIR configurado usamos el endpoint /api/files/ para servir
const USE_API_SERVE = Boolean(process.env.UPLOAD_DIR);

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

        // Crear directorio si no existe
        await mkdir(UPLOAD_DIR, { recursive: true });

        // Generar nombre de archivo único
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase();
        const filename = `${timestamp}-${sanitizedName}`;
        const filePath = path.join(UPLOAD_DIR, filename);

        // Escribir el archivo en el volumen
        await writeFile(filePath, buffer);

        // En Railway usamos /api/files/ para servir desde el volumen.
        // En local usamos /uploads/ (carpeta public, servida estáticamente por Next.js).
        const url = USE_API_SERVE
            ? `/api/files/${filename}`
            : `/uploads/${filename}`;

        return NextResponse.json({ success: true, url, filename });
    } catch (error) {
        console.error("Error en upload:", error);
        return NextResponse.json(
            { error: "Error interno al subir el archivo" },
            { status: 500 }
        );
    }
}
