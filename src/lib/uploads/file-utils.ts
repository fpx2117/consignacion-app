// src/lib/file-utils.ts

import { unlink } from "fs/promises";
import { resolveStoredUploadPathFromUrl } from "@/lib/uploads/uploads";

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

/**
 * Elimina un archivo físico guardado por el flujo de uploads.
 * @param url La URL guardada en la base de datos (ej: /api/files/uuid.png o /uploads/legacy.png)
 */
export async function deleteFileSystemImage(url: string | null | undefined) {
  if (!url) return;

  try {
    const filePath = resolveStoredUploadPathFromUrl(url);
    if (!filePath) return;

    await unlink(filePath);
    console.log(`Archivo eliminado: ${filePath}`);
  } catch (error: unknown) {
    // Si el archivo no existe, no tiramos error, solo logueamos
    if (isNodeError(error) && error.code === "ENOENT") {
      console.warn(`Intento de borrar archivo inexistente: ${url}`);
    } else {
      console.error(`Error al borrar archivo: ${url}`, error);
    }
  }
}
