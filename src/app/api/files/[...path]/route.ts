// src/app/api/files/[...path]/route.ts
// Sirve archivos del volumen persistente de Railway en /app/uploads

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = process.env.UPLOAD_DIR
    ? process.env.UPLOAD_DIR
    : path.join(process.cwd(), "public", "uploads");

// Mapa básico de MIME types
const MIME_MAP: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
};

export async function GET(
    _req: NextRequest,
    { params }: { params: { path: string[] } }
) {
    try {
        // Unir los segmentos del path
        const filename = params.path.join("/");

        // Security: evitar path traversal
        const safePath = path.normalize(filename).replace(/^(\.\.(\/|\\|$))+/, "");
        const filePath = path.join(UPLOAD_DIR, safePath);

        // Verificar que el archivo sigue dentro del UPLOAD_DIR
        if (!filePath.startsWith(UPLOAD_DIR)) {
            return NextResponse.json({ error: "Acceso no permitido" }, { status: 403 });
        }

        const fileBuffer = await readFile(filePath);
        const ext = safePath.split(".").pop()?.toLowerCase() ?? "";
        const contentType = MIME_MAP[ext] ?? "application/octet-stream";

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch {
        return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }
}
