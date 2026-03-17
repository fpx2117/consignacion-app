// src/lib/file-utils.ts

import { unlink } from "fs/promises";
import path from "path";

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error;
}

/**
 * Elimina un archivo físico de la carpeta public/uploads
 * @param url La URL guardada en la base de datos (ej: /uploads/abc.png)
 */
export async function deleteFileSystemImage(url: string | null | undefined) {
    if (!url) return;

    try {
        // Solo permitimos borrar si la URL empieza con /uploads/
        if (!url.startsWith("/uploads/")) return;

        const filename = url.replace("/uploads/", "");
        const filePath = path.join(process.cwd(), "public", "uploads", filename);

        await unlink(filePath);
        console.log(`Archivo eliminado: ${filePath}`);
    } catch (error: unknown) {
        // Si el archivo no existe, no tiramos error, solo logueamos
        if (isNodeError(error) && error.code === 'ENOENT') {
            console.warn(`Intento de borrar archivo inexistente: ${url}`);
        } else {
            console.error(`Error al borrar archivo: ${url}`, error);
        }
    }
}
