// src/app/api/facturas-proveedor/[id]/archivo/route.ts
// Sirve el archivo original de una factura, con dos vías de autenticación:
// 1) token firmado de corta duración (sin sesión) — para el worker externo de
//    OCR (Modal), que necesita descargarlo sin credenciales de usuario.
// 2) sesión de usuario normal, con acceso a la sucursal de la factura — para
//    el visor de imagen dentro de la UI (factura-detalle-dialog.tsx).
// El motor de extracción IA (OpenRouter) nunca usa esta ruta: recibe el texto
// ya extraído localmente, no una URL para descargar el archivo.

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getFacturaProveedorStorageDir } from "@/lib/uploads/uploads";
import { verifyFacturaArchivoToken } from "@/lib/security/factura-proveedor-token";
import { requireAuth } from "@/lib/auth/require-auth";
import { canAccessSucursalResource } from "@/lib/security/sucursalScope";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const facturaId = Number(id);
  if (!Number.isInteger(facturaId)) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 },
    );
  }

  const token = req.nextUrl.searchParams.get("token");
  const factura = await prisma.facturaProveedor.findUnique({
    where: { id: facturaId },
    select: { archivoPath: true, archivoMime: true, sucursalId: true },
  });
  if (!factura) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 },
    );
  }

  let autorizado = verifyFacturaArchivoToken(facturaId, token);
  if (!autorizado) {
    const auth = await requireAuth();
    autorizado = auth.ok && canAccessSucursalResource(auth, factura.sucursalId);
  }
  if (!autorizado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Defensa en profundidad: archivoPath siempre se genera server-side como un nombre
  // opaco (uuid.ext) sin separadores de path, pero lo validamos antes de usarlo en
  // un path.join para no depender únicamente de esa garantía.
  if (!/^[0-9a-f-]+\.(pdf|jpg|png|webp)$/i.test(factura.archivoPath)) {
    return NextResponse.json(
      { error: "Archivo no encontrado" },
      { status: 404 },
    );
  }

  try {
    const filePath = path.join(
      getFacturaProveedorStorageDir(),
      factura.archivoPath,
    );
    const buffer = await readFile(filePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": factura.archivoMime,
        "Cache-Control": "no-store",
        "Content-Disposition": "inline",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[FACTURA_PROVEEDOR_ARCHIVO_ERROR]", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Archivo no encontrado" },
      { status: 404 },
    );
  }
}
