// src/app/api/upload/route.ts

import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import {
  buildOpaqueUploadFilename,
  getUploadStorageDir,
  getUploadUrl,
  validateUploadCandidate,
} from "@/lib/uploads/uploads";

type UploadDeps = {
  mkdir: typeof mkdir;
  requireAuth: typeof requireAuth;
  requireRole: typeof requireRole;
  writeFile: typeof writeFile;
  uploadDir: string;
};

const defaultDeps: UploadDeps = {
  mkdir,
  requireAuth,
  requireRole,
  writeFile,
  uploadDir: getUploadStorageDir(),
};

export async function handleUpload(
  req: Request,
  deps: UploadDeps = defaultDeps,
) {
  const auth = await deps.requireAuth();
  if (!auth.ok) return auth.res;

  if (!deps.requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No se encontró el archivo" },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "El archivo esta vacio" },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const validation = validateUploadCandidate({
      buffer,
      declaredMimeType: file.type,
      originalFilename: file.name,
      size: file.size,
      useCase: "product-image",
    });

    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status },
      );
    }

    await deps.mkdir(deps.uploadDir, { recursive: true });

    const filename = buildOpaqueUploadFilename(validation.normalizedExtension);
    const filePath = path.join(deps.uploadDir, filename);

    await deps.writeFile(filePath, buffer);

    const url = getUploadUrl(filename);

    return NextResponse.json({ success: true, url, filename });
  } catch (error) {
    console.error("Error en upload:", error);
    return NextResponse.json(
      { error: "Error interno al subir el archivo" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return handleUpload(req);
}
