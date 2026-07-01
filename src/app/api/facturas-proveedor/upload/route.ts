// src/app/api/facturas-proveedor/upload/route.ts
// Fase 3: sube el archivo de una factura de proveedor (PDF/imagen), lo persiste en
// disco (fuera del árbol servido públicamente por /api/files) y crea el registro
// FacturaProveedor en estado PENDIENTE. El procesamiento OCR/Modal es un paso aparte
// (POST /api/facturas-proveedor/:id/process, todavía no implementado).

import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { isGlobalSucursalView } from "@/lib/security/sucursalScope";
import { checkFacturaOcrLimit } from "@/lib/subscriptions/require-subscription";
import {
  buildOpaqueUploadFilename,
  getFacturaProveedorStorageDir,
  validateUploadCandidate,
} from "@/lib/uploads/uploads";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      { error: "Vista global en modo solo lectura. Selecciona una sucursal para cargar una factura." },
      { status: 409 },
    );
  }
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No tienes permisos (Admin requerido)" }, { status: 403 });
  }

  const cupo = await checkFacturaOcrLimit();
  if (!cupo.allowed) {
    return NextResponse.json({ error: cupo.message }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateUploadCandidate({
      buffer,
      declaredMimeType: file.type,
      originalFilename: file.name,
      size: file.size,
      useCase: "factura-proveedor",
    });

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const storageDir = getFacturaProveedorStorageDir();
    await mkdir(storageDir, { recursive: true });

    const filename = buildOpaqueUploadFilename(validation.normalizedExtension);
    const filePath = path.join(storageDir, filename);
    await writeFile(filePath, buffer);

    const factura = await prisma.facturaProveedor.create({
      data: {
        sucursalId: auth.activeSucursalId,
        archivoPath: filename, // sólo el nombre: la carpeta base se resuelve server-side
        archivoMime: validation.contentType,
        creadoPor: Number(auth.user.sub),
      },
    });

    return NextResponse.json({ data: factura }, { status: 201 });
  } catch (error) {
    console.error("[FACTURA_PROVEEDOR_UPLOAD_ERROR]", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Error interno al subir la factura" },
      { status: 500 },
    );
  }
}
