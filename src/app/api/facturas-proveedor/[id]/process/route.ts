// src/app/api/facturas-proveedor/[id]/process/route.ts
// Fase 4: dispara la extracción IA (OpenRouter) para una factura ya subida. El
// backend extrae texto localmente (CPU, ver extraer-texto-factura.ts) y le manda
// sólo texto a OpenRouter — nunca el archivo. OpenRouter sólo extrae texto/items;
// el backend corre el matching por capas (matching-engine.ts) contra el catálogo
// de la sucursal y deja la factura en REQUIERE_REVISION. Ningún match, por más
// "seguro" que sea, actualiza stock o costo acá — eso ocurre recién al confirmar
// (endpoints /items/:id/confirm, /items/:id/create-product).

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { EstadoFacturaProveedor, Prisma } from "@prisma/client";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { canAccessSucursalResource } from "@/lib/security/sucursalScope";
import { getFacturaProveedorStorageDir } from "@/lib/uploads/uploads";
import {
  procesarFacturaConIA,
  AiExtractionConfigError,
  AiExtractionRequestError,
  AiExtractionTimeoutError,
} from "@/lib/ai/invoice-ai-parser";
import { construirContextoMatching, matchearItem } from "@/lib/ocr/matching-engine";
import { normalizarProducto } from "@/lib/ocr/normalizar-producto";

const PROCESABLES: EstadoFacturaProveedor[] = [
  EstadoFacturaProveedor.PENDIENTE,
  EstadoFacturaProveedor.ERROR,
];

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No tienes permisos (Admin requerido)" }, { status: 403 });
  }

  const { id } = await params;
  const facturaId = Number(id);
  if (!Number.isInteger(facturaId)) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  const factura = await prisma.facturaProveedor.findUnique({ where: { id: facturaId } });
  if (!factura || !canAccessSucursalResource(auth, factura.sucursalId)) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  if (!PROCESABLES.includes(factura.estado)) {
    return NextResponse.json(
      { error: `La factura está en estado ${factura.estado} y no se puede reprocesar.` },
      { status: 409 },
    );
  }

  await prisma.facturaProveedor.update({
    where: { id: facturaId },
    data: { estado: EstadoFacturaProveedor.PROCESANDO, errorMensaje: null },
  });

  try {
    const filePath = path.join(getFacturaProveedorStorageDir(), factura.archivoPath);
    const buffer = await readFile(filePath);

    // Rubro de la sucursal que subió la factura — solo contexto para el
    // prompt (ver invoice-extraction.config.ts), nunca cambia el pipeline.
    const configuracion = await prisma.configuracion.findUnique({
      where: { sucursalId: factura.sucursalId },
      select: { rubroNegocio: true },
    });

    const resultado = await procesarFacturaConIA({
      buffer,
      mimeType: factura.archivoMime,
      rubroNegocio: configuracion?.rubroNegocio,
    });

    if (resultado.status === "error") {
      await prisma.facturaProveedor.update({
        where: { id: facturaId },
        data: { estado: EstadoFacturaProveedor.ERROR, errorMensaje: resultado.message },
      });
      return NextResponse.json({ error: `La IA reportó un error: ${resultado.message}` }, { status: 422 });
    }

    // Proveedor: si ya venía asignado, no lo tocamos. Si no, intentamos un match
    // exacto por nombre (case-insensitive) contra proveedores existentes; si no
    // hay match, se guarda el nombre detectado para que el usuario lo confirme o
    // cree el proveedor en la pantalla de revisión — nunca se crea automáticamente.
    let proveedorId = factura.proveedorId;
    if (!proveedorId && resultado.supplier.name) {
      const match = await prisma.proveedor.findFirst({
        where: { nombre: { equals: resultado.supplier.name, mode: "insensitive" }, activo: true },
      });
      if (match) proveedorId = match.id;
    }

    // Contexto de matching: catálogo de la sucursal + alias aprendidos del proveedor
    // (si ya se identificó). Se construye una sola vez para toda la factura, no por item.
    const contextoMatching = await construirContextoMatching({
      sucursalId: factura.sucursalId,
      proveedorId,
    });

    const facturaActualizada = await prisma.$transaction(async (tx) => {
      await tx.facturaProveedor.update({
        where: { id: facturaId },
        data: {
          estado: EstadoFacturaProveedor.REQUIERE_REVISION,
          proveedorId,
          proveedorNombreDetectado: resultado.supplier.name,
          proveedorCuitDetectado: resultado.supplier.taxId,
          numeroFactura: resultado.invoice.number,
          fecha: resultado.invoice.date ? new Date(resultado.invoice.date) : null,
          moneda: resultado.invoice.currency || factura.moneda,
          totalDetectado: resultado.invoice.total,
          ocrTextoCompleto: resultado.ocrText,
          confianzaOcr: resultado.globalConfidence,
          iaRespuestaCruda: resultado.aiRawResponse as Prisma.InputJsonValue,
          iaModeloUsado: resultado.aiModel,
          iaTokensUsados: resultado.aiUsage?.totalTokens ?? null,
        },
      });

      for (const item of resultado.items) {
        const match = matchearItem(
          { textoOriginal: item.rawDescription, codigoProveedor: item.supplierCode },
          contextoMatching,
        );

        await tx.facturaProveedorItem.create({
          data: {
            facturaId,
            textoOriginal: item.rawDescription,
            descripcionNormalizada: normalizarProducto(item.rawDescription).normalizado || null,
            codigoProveedor: item.supplierCode,
            cantidad: Math.max(1, Math.trunc(item.quantity)),
            precioUnitario: item.unitCost,
            totalLinea: item.lineTotal,
            confianzaExtraccion: item.confidence,
            productoId: match.productoId,
            matchScore: match.score,
            matchMotivo: match.motivo,
            estado: match.estado,
            atributosExtra: item.atributosExtra ?? undefined,
          },
        });
      }

      // El `update` de arriba no trae los items (se crean después, en este mismo
      // loop) — hay que releerla con la relación incluida para que el frontend
      // reciba las filas recién creadas en la misma respuesta.
      return tx.facturaProveedor.findUniqueOrThrow({
        where: { id: facturaId },
        include: { items: true, proveedor: true },
      });
    });

    return NextResponse.json({
      data: facturaActualizada,
      itemsCreados: resultado.items.length,
      warnings: resultado.warnings,
    });
  } catch (error) {
    const mensaje =
      error instanceof AiExtractionConfigError
        ? `La IA no está configurada en este entorno: ${error.message}`
        : error instanceof AiExtractionTimeoutError
          ? "La IA no respondió a tiempo. Podés reintentar el procesamiento."
          : error instanceof AiExtractionRequestError
            ? `Error al contactar a OpenRouter: ${error.message}`
            : error instanceof Error
              ? error.message
              : "Error desconocido al procesar la factura";

    console.error("[FACTURA_PROVEEDOR_PROCESS_ERROR]", { facturaId, mensaje });

    await prisma.facturaProveedor.update({
      where: { id: facturaId },
      data: { estado: EstadoFacturaProveedor.ERROR, errorMensaje: mensaje },
    });

    return NextResponse.json({ error: mensaje }, { status: 502 });
  }
}
