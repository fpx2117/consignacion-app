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
import { buscarCandidatosGlobales } from "@/lib/ai/catalogo-global-client";

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
        where: {
          nombre: { equals: resultado.supplier.name, mode: "insensitive" },
          activo: true,
          sucursalId: factura.sucursalId,
        },
      });
      if (match) proveedorId = match.id;
    }

    // Contexto de matching: catálogo de la sucursal + alias aprendidos del proveedor
    // (si ya se identificó). Se construye una sola vez para toda la factura, no por item.
    const contextoMatching = await construirContextoMatching({
      sucursalId: factura.sucursalId,
      proveedorId,
    });

    // matchearItem() es CPU pura (sin consultas a la base) — se resuelve acá, antes
    // de abrir la transacción, para no alargarla con trabajo que no necesita estar
    // dentro de ella.
    const matches = resultado.items.map((item) =>
      matchearItem(
        { textoOriginal: item.rawDescription, codigoProveedor: item.supplierCode },
        contextoMatching,
      ),
    );

    // Catálogo global (catalogo-global-api, servicio separado — ver
    // openspec/changes/catalogo-global-api): tercera fuente, consultada solo
    // para líneas sin match local (mismo criterio que "requiereAlta" en el
    // diálogo de revisión) — nunca reemplaza ni bloquea el matching existente,
    // degrada a [] si la API central no está configurada o falla. Se consulta
    // en paralelo por línea, después del matching local y fuera de la
    // transacción, igual que este.
    const rubroNegocio = configuracion?.rubroNegocio;
    const candidatosGlobalesPorItem = await Promise.all(
      resultado.items.map((item, index) =>
        rubroNegocio && matches[index].productoId === null
          ? buscarCandidatosGlobales({ rubro: rubroNegocio, descripcion: item.rawDescription, limit: 3 })
          : Promise.resolve([]),
      ),
    );

    const itemsData = resultado.items.map((item, index) => {
      const match = matches[index];
      const candidatoGlobal = candidatosGlobalesPorItem[index][0];

      return {
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
        advertencias: item.advertencias,
        candidatoGlobalId: candidatoGlobal?.id ?? null,
        candidatoGlobalNombre: candidatoGlobal?.nombreNormalizado ?? null,
        candidatoGlobalCodigoBarras: candidatoGlobal?.codigoBarras ?? null,
        candidatoGlobalScore: candidatoGlobal?.score ?? null,
      };
    });

    // { timeout: 15000 }: el default de Prisma (5000ms) alcanzaba a superarse en
    // facturas con muchos ítems cuando el insert era secuencial (N round-trips). Con
    // createMany() ya no debería hacer falta tanto margen, pero se deja como red de
    // seguridad — ver openspec/changes/fix-timeout-transaccion-facturas-proveedor.
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

      if (itemsData.length > 0) {
        // Un único round-trip para todos los ítems, en vez de uno por ítem — con
        // facturas de 20-30+ líneas, el loop secuencial anterior podía superar el
        // timeout de la transacción.
        await tx.facturaProveedorItem.createMany({ data: itemsData });
      }

      // El `update` de arriba no trae los items (se crean después) — hay que
      // releerla con la relación incluida para que el frontend reciba las filas
      // recién creadas en la misma respuesta.
      return tx.facturaProveedor.findUniqueOrThrow({
        where: { id: facturaId },
        include: { items: true, proveedor: true },
      });
    }, { timeout: 15000 });

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
