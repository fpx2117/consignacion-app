// src/lib/ai/invoice-ai-parser.ts
// Reemplaza a src/lib/modal/ocr-client.ts. Orquesta: visión directa de la
// imagen de la factura → prompt dinámico desde invoice-extraction.config.ts →
// OpenRouter → validación → shape normalizado para el resto del pipeline
// (matching-engine, etc.), que no se modifica.
//
// Solo se aceptan imágenes (JPG, PNG, WEBP): el OCR local
// (sharp/tesseract/pdf-parse/chromium) fue eliminado. La imagen se manda tal
// cual al modelo de visión de OpenRouter (image_url), que la lee y estructura
// en un solo call — ver openspec/changes sobre visión directa.

import {
  buildExpectedOutputSchema,
  buildInvoiceExtractionPrompt,
  calculateInvoiceConfidence,
  validateExtractedInvoice,
  type ExtractedInvoiceData,
  type ExtractedInvoiceItem,
} from "@/modules/invoices/config/invoice-extraction.config";
import { esImagenSoportada } from "@/lib/ocr/mime-types";
import { validarConsistenciaFactura } from "./validar-consistencia-factura";
import {
  callOpenRouterJson,
  parseJsonContent,
  OpenRouterConfigError,
  OpenRouterRequestError,
  OpenRouterTimeoutError,
  type OpenRouterUsage,
} from "./openrouter-client";

export {
  OpenRouterConfigError as AiExtractionConfigError,
  OpenRouterRequestError as AiExtractionRequestError,
  OpenRouterTimeoutError as AiExtractionTimeoutError,
};

export type InvoiceAiItem = {
  rawDescription: string;
  supplierCode: string | null;
  quantity: number;
  unitCost: number | null;
  lineTotal: number | null;
  confidence: number | null;
  /** Columnas detectadas sin campo estándar (lote, vencimiento, talle, color,
   * etc.), como objeto plano — null si no se detectó ninguna. */
  atributosExtra: Record<string, string> | null;
  /** Advertencias de la validación aritmética determinística post-extracción
   * (ver validar-consistencia-factura.ts) — nunca generadas por el modelo. */
  advertencias: string[];
};

export type InvoiceAiSuccessResult = {
  status: "success";
  ocrText: string;
  supplier: { name: string | null; taxId: string | null };
  invoice: {
    number: string | null;
    date: string | null;
    currency: string | null;
    total: number | null;
  };
  items: InvoiceAiItem[];
  warnings: string[];
  globalConfidence: number;
  aiModel: string;
  aiUsage: OpenRouterUsage | null;
  aiRawResponse: unknown;
};

export type InvoiceAiErrorResult = {
  status: "error";
  message: string;
};

export type InvoiceAiResult = InvoiceAiSuccessResult | InvoiceAiErrorResult;

/**
 * Procesa una factura ya subida (bytes en poder del backend): manda la imagen
 * directo al modelo de visión de OpenRouter y estructura la respuesta. Nunca
 * escribe en la DB — eso lo sigue haciendo el caller (process/route.ts) con
 * matching-engine.
 *
 * Solo se soportan imágenes (jpg/png/webp): los tickets se cargan como imagen,
 * no como PDF. El OCR local (sharp/tesseract/chromium/pdf-parse) fue eliminado
 * del flujo de facturas — ver openspec/changes sobre visión directa.
 */
export async function procesarFacturaConIA(input: {
  buffer: Buffer;
  mimeType: string;
  /** Configuracion.rubroNegocio de la sucursal de la factura — solo contexto
   * para el prompt, ver invoice-extraction.config.ts. */
  rubroNegocio?: string | null;
}): Promise<InvoiceAiResult> {
  const { buffer, mimeType } = input;
  const esImagen = esImagenSoportada(mimeType);

  if (!esImagen) {
    return {
      status: "error",
      message: `Solo se admiten imágenes (JPG, PNG, WEBP). Tipo recibido: ${mimeType || "(vacío)"}.`,
    };
  }

  // Visión directa: se manda el archivo tal cual al modelo de visión
  // (image_url), sin pasar por ningún OCR local.
  const texto = "";
  const imagenParaVision: Buffer = buffer;

  const systemPrompt = buildInvoiceExtractionPrompt(input.rubroNegocio);
  const schema = buildExpectedOutputSchema();

  const userPrompt =
    `Extraé los datos estructurados de esta factura de proveedor según las reglas indicadas. ` +
    `Se te adjunta la imagen del comprobante como fuente de verdad: leela directamente y extraé ` +
    `proveedor, datos generales y cada item con su código, cantidad, precio unitario y total de línea.\n\n` +
    `NO se adjunta texto OCR previo: toda la información sale de la imagen.`;

  const respuesta = await callOpenRouterJson({
    systemPrompt,
    userPrompt,
    jsonSchema: { name: "factura_extraida", schema },
    images: [
      {
        mimeType,
        base64: imagenParaVision.toString("base64"),
      },
    ],
  });

  const parsed = parseJsonContent(respuesta.content);
  const validacion = validateExtractedInvoice(parsed);
  if (!validacion.valid) {
    return {
      status: "error",
      message: `Respuesta de IA con formato inválido: ${validacion.errors.join("; ")}`,
    };
  }

  const datos = normalizarExtraccion(parsed as Record<string, unknown>, texto);

  // Validación determinística, en código, de lo que devolvió el modelo — nunca
  // reescribe unitCost/quantity/lineTotal, solo topea (nunca sube) la confidence
  // reportada y agrega advertencias. Ver validar-consistencia-factura.ts: el
  // prompt ya le pide al modelo que se autoevalúe, pero en la práctica eso no
  // es confiable por sí solo (caso real: confidence=1 en líneas con precios
  // desalineados varios miles de pesos).
  const consistencia = validarConsistenciaFactura(datos);
  const itemsConConfidenceAjustada = datos.items.map((item, index) => {
    const tope = consistencia.confidenceMaximaPorItem.get(index);
    return tope != null && item.confidence != null
      ? { ...item, confidence: Math.min(item.confidence, tope) }
      : item;
  });
  const datosConConfidenceAjustada = {
    ...datos,
    items: itemsConConfidenceAjustada,
  };

  // Siempre se usa visión directa (el modelo ve la imagen real), así que la
  // confianza final es la del modelo con la imagen — no se capa contra un
  // confianzaOcr local (ya no existe OCR local).
  const globalConfidence = calculateInvoiceConfidence(
    datosConConfidenceAjustada,
  );

  return {
    status: "success",
    ocrText: texto,
    supplier: datos.supplier,
    invoice: datos.invoice,
    items: itemsConConfidenceAjustada.map((item, index) => ({
      rawDescription: item.rawDescription,
      supplierCode: item.supplierCode,
      quantity: item.quantity,
      unitCost: item.unitCost,
      lineTotal: item.lineTotal,
      confidence: item.confidence,
      atributosExtra:
        item.extraAttributes.length > 0
          ? Object.fromEntries(
              item.extraAttributes.map((a) => [a.key, a.value]),
            )
          : null,
      advertencias: consistencia.itemsConAdvertencia.get(index) ?? [],
    })),
    warnings: [...datos.warnings, ...consistencia.advertenciasFactura],
    globalConfidence,
    aiModel: respuesta.model,
    aiUsage: respuesta.usage,
    aiRawResponse: parsed,
  };
}

function normalizarExtraccion(
  data: Record<string, unknown>,
  ocrTextRaw: string,
): ExtractedInvoiceData & { ocrTextRaw: string } {
  const supplier = (data.supplier as Record<string, unknown> | undefined) ?? {};
  const invoice = (data.invoice as Record<string, unknown> | undefined) ?? {};
  const rawItems = Array.isArray(data.items) ? data.items : [];

  const items: ExtractedInvoiceItem[] = rawItems
    .map((raw): ExtractedInvoiceItem => {
      const item = raw as Record<string, unknown>;
      const rawExtraAttributes = Array.isArray(item.extraAttributes)
        ? item.extraAttributes
        : [];
      return {
        rawDescription:
          typeof item.rawDescription === "string" ? item.rawDescription : "",
        supplierCode:
          typeof item.supplierCode === "string" ? item.supplierCode : null,
        quantity:
          typeof item.quantity === "number" && Number.isFinite(item.quantity)
            ? item.quantity
            : 1,
        unitCost:
          typeof item.unitCost === "number" && Number.isFinite(item.unitCost)
            ? item.unitCost
            : null,
        lineTotal:
          typeof item.lineTotal === "number" && Number.isFinite(item.lineTotal)
            ? item.lineTotal
            : null,
        confidence:
          typeof item.confidence === "number" &&
          Number.isFinite(item.confidence)
            ? item.confidence
            : null,
        extraAttributes: rawExtraAttributes
          .filter(
            (a): a is Record<string, unknown> => !!a && typeof a === "object",
          )
          .map((a) => ({
            key: typeof a.key === "string" ? a.key : "",
            value: typeof a.value === "string" ? a.value : "",
          }))
          .filter((a) => a.key.trim().length > 0 && a.value.trim().length > 0),
      };
    })
    .filter((item) => item.rawDescription.trim().length > 0);

  return {
    ocrTextRaw,
    supplier: {
      name:
        typeof supplier.name === "string" && supplier.name.trim()
          ? supplier.name.trim()
          : null,
      taxId:
        typeof supplier.taxId === "string" && supplier.taxId.trim()
          ? supplier.taxId.trim()
          : null,
    },
    invoice: {
      number: typeof invoice.number === "string" ? invoice.number : null,
      date: typeof invoice.date === "string" ? invoice.date : null,
      currency: typeof invoice.currency === "string" ? invoice.currency : null,
      total:
        typeof invoice.total === "number" && Number.isFinite(invoice.total)
          ? invoice.total
          : null,
    },
    items,
    warnings: Array.isArray(data.warnings)
      ? data.warnings.filter((w): w is string => typeof w === "string")
      : [],
  };
}
