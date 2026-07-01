// src/app/api/productos/ocr-factura/analizar/route.ts
// OCR de facturas con soporte para Railway.
//
// Flujo de procesamiento (priorizando la ruta más liviana):
//   Imagen (JPG/PNG/WEBP) → preprocesarImagen + recognizeImage (Tesseract, sin Chromium)
//   PDF nativo           → extraerTextoPdf (pdf-parse, sin Chromium)
//   PDF escaneado        → rasterizarPdf (Puppeteer/Chromium) + recognizeImage (Tesseract)
//
// Esto evita el error 502 en Railway al no forzar Chromium innecesariamente.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { isGlobalSucursalView } from "@/lib/security/sucursalScope";
import {
  esPdf,
  esImagenSoportada,
  preprocesarImagen,
  rasterizarPdf,
  extraerTextoPdf,
} from "@/lib/ocr/ocr-engine";
import { recognizeImage } from "@/lib/ocr/tesseract-service";
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

    // ── Extraer texto según el tipo de archivo ──────────────────
    let texto: string;
    let confianza: number;

    if (esPdf(mimeType)) {
      // 1) Intentar extraer texto nativo del PDF (sin Chromium)
      const textoNativo = await extraerTextoPdf(buffer);
      if (textoNativo) {
        texto = textoNativo;
        confianza = 100; // texto nativo = precisión perfecta
        console.log("[OCR] Usando texto nativo de PDF (sin Chromium)");
      } else {
        // 2) Fallback: rasterizar con Chromium y aplicar OCR
        console.log("[OCR] PDF sin texto nativo, rasterizando con Chromium...");
        const imagenParaOcr = await rasterizarPdf(buffer);
        const preprocesada = await preprocesarImagen(imagenParaOcr);
        const resultado = await recognizeImage(preprocesada);
        texto = resultado.texto;
        confianza = resultado.confianza;
      }
    } else {
      // Imagen: preprocesar + Tesseract directo (sin Chromium)
      console.log("[OCR] Procesando imagen directamente (sin Chromium)");
      const preprocesada = await preprocesarImagen(buffer);
      const resultado = await recognizeImage(preprocesada);
      texto = resultado.texto;
      confianza = resultado.confianza;
    }

    // ── Parsear líneas detectadas ───────────────────────────────
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
    console.error("[OCR_ERROR]", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Error interno al analizar la factura" },
      { status: 500 },
    );
  }
}
