// src/app/api/productos/ocr-factura/analizar/route.ts
// PoC de OCR de facturas (Opción B del análisis en docs/features/import-productos-excel-ocr.md).
// Recibe una imagen o PDF de una factura, corre OCR (Tesseract.js) y devuelve un borrador
// de líneas de producto detectadas para revisión manual. No escribe nada en la base de datos.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { isGlobalSucursalView } from "@/lib/security/sucursalScope";
import { reconocerTexto, rasterizarPdf, esPdf, esImagenSoportada } from "@/lib/ocr/ocr-engine";
import { parseFacturaTexto } from "@/lib/ocr/parse-factura";
import { matchProductoPorNombre } from "@/lib/ocr/match-producto";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      { error: "Vista global en modo solo lectura. Selecciona una sucursal para cargar por factura." },
      { status: 409 },
    );
  }
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No tienes permisos (Admin requerido)" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "El archivo supera el máximo de 15MB" }, { status: 413 });
    }

    const mimeType = file.type;
    if (!esPdf(mimeType) && !esImagenSoportada(mimeType)) {
      return NextResponse.json(
        { error: "Formato no soportado. Usá una imagen (JPG/PNG/WEBP) o un PDF." },
        { status: 415 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const imagenParaOcr = esPdf(mimeType) ? await rasterizarPdf(buffer) : buffer;

    const { texto, confianza } = await reconocerTexto(imagenParaOcr);
    const lineasDetectadas = parseFacturaTexto(texto);

    const sucursalId = auth.activeSucursalId;
    const productosSucursal = await prisma.producto.findMany({
      where: { sucursalId, activo: true },
      select: { id: true, nombre: true },
    });

    const filas = lineasDetectadas.map((linea, index) => {
      const match = matchProductoPorNombre(linea.nombreDetectado, productosSucursal);
      return {
        id: index,
        textoOriginal: linea.textoOriginal,
        nombreDetectado: linea.nombreDetectado,
        cantidadDetectada: linea.cantidadDetectada,
        precioDetectado: linea.precioDetectado,
        productoSugeridoId: match?.productoId ?? null,
        productoSugeridoNombre:
          match ? productosSucursal.find((p) => p.id === match.productoId)?.nombre ?? null : null,
        matchScore: match?.score ?? null,
      };
    });

    return NextResponse.json({
      data: {
        confianzaOcr: confianza,
        filas,
      },
    });
  } catch (error) {
    console.error("Error en análisis OCR de factura:", error);
    return NextResponse.json(
      { error: "Error interno al analizar la factura" },
      { status: 500 },
    );
  }
}
