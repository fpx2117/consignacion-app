// src/lib/ai/invoice-ai-parser.ts
// Reemplaza a src/lib/modal/ocr-client.ts. Orquesta: extracción de texto barata
// (CPU, ver extraer-texto-factura.ts) → prompt dinámico desde
// invoice-extraction.config.ts → OpenRouter → validación → shape normalizado
// para el resto del pipeline (matching-engine, etc.), que no se modifica. Por
// defecto solo se manda texto (costo por tokens, previsible); si la confianza
// de OCR es baja o el texto vino vacío, se suma también la imagen original
// como fallback (ver OCR_VISION_FALLBACK_THRESHOLD abajo).

import {
  buildExpectedOutputSchema,
  buildInvoiceExtractionPrompt,
  calculateInvoiceConfidence,
  truncateOcrText,
  validateExtractedInvoice,
  type ExtractedInvoiceData,
  type ExtractedInvoiceItem,
} from "@/modules/invoices/config/invoice-extraction.config";
import { extraerTextoFactura } from "@/lib/ocr/extraer-texto-factura";
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
};

export type InvoiceAiSuccessResult = {
  status: "success";
  ocrText: string;
  supplier: { name: string | null; taxId: string | null };
  invoice: { number: string | null; date: string | null; currency: string | null; total: number | null };
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

// Debajo de este umbral de confianza de OCR (0-100), o con texto vacío, se
// escala a un único llamado combinado (texto + imagen) a un modelo con
// visión, en vez de mandar solo el texto ruidoso/vacío que devolvió el OCR
// local. Ver openspec/changes/rubro-contexto-ocr/design.md — "Fallback
// híbrido: OCR + Visión".
const OCR_VISION_FALLBACK_THRESHOLD = Number(process.env.OCR_VISION_FALLBACK_THRESHOLD) || 55;

/**
 * Procesa una factura ya subida (bytes en poder del backend): extrae texto
 * localmente y le pide a OpenRouter que lo estructure. Nunca escribe en la DB —
 * eso lo sigue haciendo el caller (process/route.ts) con matching-engine.
 */
export async function procesarFacturaConIA(input: {
  buffer: Buffer;
  mimeType: string;
  /** Configuracion.rubroNegocio de la sucursal de la factura — solo contexto
   * para el prompt, ver invoice-extraction.config.ts. */
  rubroNegocio?: string | null;
}): Promise<InvoiceAiResult> {
  const { texto, confianzaOcr, imagenParaVision } = await extraerTextoFactura(input);

  const necesitaVision = Boolean(imagenParaVision) && (!texto.trim() || confianzaOcr < OCR_VISION_FALLBACK_THRESHOLD);

  if (!texto.trim() && !necesitaVision) {
    // Caso residual: PDF con texto nativo que igual vino vacío — no hubo
    // rasterización (imagenParaVision es null acá), no hay imagen que ofrecer.
    return { status: "error", message: "No se pudo extraer texto legible del archivo." };
  }

  const textoTruncado = truncateOcrText(texto);
  const systemPrompt = buildInvoiceExtractionPrompt(input.rubroNegocio);
  const schema = buildExpectedOutputSchema();

  const userPrompt = necesitaVision
    ? `Extraé los datos estructurados de esta factura de proveedor según las reglas indicadas. ` +
      `El texto que devolvió el OCR local ${texto.trim() ? `tiene baja confianza (${confianzaOcr}%) y puede tener errores o partes faltantes` : "no pudo leer nada"}. ` +
      `Se adjunta también la imagen original — usá el texto como referencia rápida y la imagen para completar o corregir lo que falte.\n\n` +
      `Texto OCR:\n${textoTruncado || "(vacío)"}`
    : `Extraé los datos estructurados de esta factura de proveedor según las reglas indicadas:\n\n${textoTruncado}`;

  const respuesta = await callOpenRouterJson({
    systemPrompt,
    userPrompt,
    jsonSchema: { name: "factura_extraida", schema },
    images: necesitaVision ? [{ mimeType: "image/jpeg", base64: imagenParaVision!.toString("base64") }] : undefined,
  });

  const parsed = parseJsonContent(respuesta.content);
  const validacion = validateExtractedInvoice(parsed);
  if (!validacion.valid) {
    return { status: "error", message: `Respuesta de IA con formato inválido: ${validacion.errors.join("; ")}` };
  }

  const datos = normalizarExtraccion(parsed as Record<string, unknown>, texto);
  // La confianza final es el mínimo entre "qué tan bien se leyó el archivo"
  // (Tesseract/pdf-parse, 0-100) y "qué tan segura está la IA de haber
  // estructurado bien ese texto" (0-1). Una foto borrosa con OCR de baja
  // confianza debe marcar la factura para revisión aunque la IA "suene seguro"
  // interpretando el texto ruidoso que le llegó — EXCEPTO cuando se usó
  // visión: ahí la IA tuvo la imagen real, no solo el texto degradado, así
  // que capar su confianza contra confianzaOcr (bajo por definición en este
  // camino) penalizaría injustamente una extracción que sí rescató bien.
  const globalConfidence = necesitaVision
    ? calculateInvoiceConfidence(datos)
    : Math.min(calculateInvoiceConfidence(datos), confianzaOcr / 100);

  return {
    status: "success",
    ocrText: texto,
    supplier: datos.supplier,
    invoice: datos.invoice,
    items: datos.items.map((item) => ({
      rawDescription: item.rawDescription,
      supplierCode: item.supplierCode,
      quantity: item.quantity,
      unitCost: item.unitCost,
      lineTotal: item.lineTotal,
      confidence: item.confidence,
      atributosExtra: item.extraAttributes.length > 0
        ? Object.fromEntries(item.extraAttributes.map((a) => [a.key, a.value]))
        : null,
    })),
    warnings: datos.warnings,
    globalConfidence,
    aiModel: respuesta.model,
    aiUsage: respuesta.usage,
    aiRawResponse: parsed,
  };
}

function normalizarExtraccion(data: Record<string, unknown>, ocrTextRaw: string): ExtractedInvoiceData & { ocrTextRaw: string } {
  const supplier = (data.supplier as Record<string, unknown> | undefined) ?? {};
  const invoice = (data.invoice as Record<string, unknown> | undefined) ?? {};
  const rawItems = Array.isArray(data.items) ? data.items : [];

  const items: ExtractedInvoiceItem[] = rawItems
    .map((raw): ExtractedInvoiceItem => {
      const item = raw as Record<string, unknown>;
      const rawExtraAttributes = Array.isArray(item.extraAttributes) ? item.extraAttributes : [];
      return {
        rawDescription: typeof item.rawDescription === "string" ? item.rawDescription : "",
        supplierCode: typeof item.supplierCode === "string" ? item.supplierCode : null,
        quantity: typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1,
        unitCost: typeof item.unitCost === "number" && Number.isFinite(item.unitCost) ? item.unitCost : null,
        lineTotal: typeof item.lineTotal === "number" && Number.isFinite(item.lineTotal) ? item.lineTotal : null,
        confidence: typeof item.confidence === "number" && Number.isFinite(item.confidence) ? item.confidence : null,
        extraAttributes: rawExtraAttributes
          .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
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
      name: typeof supplier.name === "string" && supplier.name.trim() ? supplier.name.trim() : null,
      taxId: typeof supplier.taxId === "string" && supplier.taxId.trim() ? supplier.taxId.trim() : null,
    },
    invoice: {
      number: typeof invoice.number === "string" ? invoice.number : null,
      date: typeof invoice.date === "string" ? invoice.date : null,
      currency: typeof invoice.currency === "string" ? invoice.currency : null,
      total: typeof invoice.total === "number" && Number.isFinite(invoice.total) ? invoice.total : null,
    },
    items,
    warnings: Array.isArray(data.warnings) ? data.warnings.filter((w): w is string => typeof w === "string") : [],
  };
}
