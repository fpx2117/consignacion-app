// src/lib/modal/ocr-client.ts
// Cliente hacia el endpoint Modal.com que sirve Qwen3.6-35B-A3B vía SGLang
// (OpenAI-compatible /v1/chat/completions, con response_format json_schema para
// decodificación estricta). El modelo puede recibir imágenes: para facturas
// escaneadas/fotos le mandamos la imagen directamente (OCR + extracción en un solo
// paso); para PDFs con texto nativo evitamos gastar VLM y le mandamos el texto ya
// extraído localmente (pdf-parse, sin costo de inferencia de imagen).
//
// El backend nunca comparte credenciales de DB con Modal — sólo manda bytes de la
// factura (ya en su poder, no hace falta que Modal los descargue) y espera de vuelta
// JSON estructurado. Modal no decide nada de negocio, sólo extrae.

import { esPdf, extraerTextoPdf, rasterizarPdf } from "@/lib/ocr/ocr-engine";

const MODAL_OCR_ENDPOINT_URL = process.env.MODAL_OCR_ENDPOINT_URL;
// Modal protege este endpoint con "Proxy Auth" (par Key+Secret, generado con
// `modal token new` o desde el dashboard > Settings > Proxy Auth Tokens) — es un
// mecanismo distinto de un Bearer token de aplicación: van en dos headers propios
// (Modal-Key / Modal-Secret), no en Authorization.
const MODAL_PROXY_KEY = process.env.MODAL_PROXY_KEY;
const MODAL_PROXY_SECRET = process.env.MODAL_PROXY_SECRET;
const MODAL_MODEL_NAME = process.env.MODAL_MODEL_NAME || "Qwen/Qwen3.6-35B-A3B";
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS) || 45000;
const OCR_MAX_TOKENS = Number(process.env.OCR_MAX_TOKENS) || 4096;
// El contenedor de Modal escala a 0 tras estar inactivo (scaledown_window) y un
// modelo de 35B en GPU puede tardar 1-3 minutos en levantar de nuevo. Mientras
// arranca, Modal devuelve 503 — hay que reintentar, no fallar en el primer intento.
const OCR_COLD_START_MAX_RETRIES = Number(process.env.OCR_COLD_START_MAX_RETRIES) || 8;
const OCR_COLD_START_RETRY_DELAY_MS = Number(process.env.OCR_COLD_START_RETRY_DELAY_MS) || 15000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ModalOcrItem = {
  rawDescription: string;
  supplierCode: string | null;
  quantity: number;
  unitCost: number | null;
  lineTotal: number | null;
  confidence: number | null;
};

export type ModalOcrSuccessResult = {
  status: "success";
  ocrText: string;
  supplier: { name: string | null; taxId: string | null };
  invoice: {
    number: string | null;
    date: string | null; // ISO 8601
    currency: string | null;
    total: number | null;
  };
  items: ModalOcrItem[];
  warnings: string[];
};

export type ModalOcrErrorResult = {
  status: "error";
  message: string;
};

export type ModalOcrResult = ModalOcrSuccessResult | ModalOcrErrorResult;

export class ModalOcrConfigError extends Error {}
export class ModalOcrTimeoutError extends Error {}
export class ModalOcrRequestError extends Error {
  constructor(message: string, readonly httpStatus?: number) {
    super(message);
  }
}

const SYSTEM_PROMPT = `Sos un asistente que extrae datos estructurados de facturas de proveedores para un sistema de inventario. Reglas estrictas:
- Devolvé únicamente los datos que puedas leer con confianza razonable. Si un campo no está legible o no aparece, usá null.
- NO inventes códigos de proveedor, precios ni cantidades que no estén escritos en la factura.
- "confidence" por línea es tu propia estimación (0 a 1) de qué tan seguro estás de haber leído bien esa línea completa.
- El campo "total" de la factura es el total general, no un subtotal.
- Las fechas van en formato ISO 8601 (YYYY-MM-DD) si podés inferir el formato con certeza; si no, null.
- "warnings" es una lista corta de problemas que notaste (ej: "factura borrosa en la zona de totales", "posible línea cortada al final de página").`;

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    supplier: {
      type: "object",
      properties: {
        name: { anyOf: [{ type: "string" }, { type: "null" }] },
        taxId: { anyOf: [{ type: "string" }, { type: "null" }] },
      },
      required: ["name", "taxId"],
      additionalProperties: false,
    },
    invoice: {
      type: "object",
      properties: {
        number: { anyOf: [{ type: "string" }, { type: "null" }] },
        date: { anyOf: [{ type: "string" }, { type: "null" }] },
        currency: { anyOf: [{ type: "string" }, { type: "null" }] },
        total: { anyOf: [{ type: "number" }, { type: "null" }] },
      },
      required: ["number", "date", "currency", "total"],
      additionalProperties: false,
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rawDescription: { type: "string" },
          supplierCode: { anyOf: [{ type: "string" }, { type: "null" }] },
          quantity: { type: "number" },
          unitCost: { anyOf: [{ type: "number" }, { type: "null" }] },
          lineTotal: { anyOf: [{ type: "number" }, { type: "null" }] },
          confidence: { type: "number" },
        },
        required: ["rawDescription", "supplierCode", "quantity", "unitCost", "lineTotal", "confidence"],
        additionalProperties: false,
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["supplier", "invoice", "items", "warnings"],
  additionalProperties: false,
} as const;

type ChatContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/**
 * Procesa una factura ya subida (bytes en poder del backend). Si es un PDF con
 * texto nativo, evita el costo de inferencia de imagen y le manda el texto al
 * modelo. Si es un PDF escaneado o una imagen, rasteriza/usa la imagen y se la
 * manda al modelo para que haga OCR + extracción en un solo paso.
 */
export async function procesarFacturaConModal(input: {
  buffer: Buffer;
  mimeType: string;
}): Promise<ModalOcrResult> {
  if (!MODAL_OCR_ENDPOINT_URL || !MODAL_PROXY_KEY || !MODAL_PROXY_SECRET) {
    throw new ModalOcrConfigError(
      "MODAL_OCR_ENDPOINT_URL / MODAL_PROXY_KEY / MODAL_PROXY_SECRET no están configurados en este entorno.",
    );
  }

  const content = await construirContenidoParaModelo(input.buffer, input.mimeType);
  const endpoint = `${MODAL_OCR_ENDPOINT_URL.replace(/\/$/, "")}/v1/chat/completions`;

  for (let intento = 0; intento <= OCR_COLD_START_MAX_RETRIES; intento++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Modal-Key": MODAL_PROXY_KEY,
          "Modal-Secret": MODAL_PROXY_SECRET,
        },
        body: JSON.stringify({
          model: MODAL_MODEL_NAME,
          temperature: 0,
          max_tokens: OCR_MAX_TOKENS,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "factura_extraida",
              schema: RESPONSE_JSON_SCHEMA,
              strict: true,
            },
          },
        }),
        signal: controller.signal,
      });

      if (response.status === 503 && intento < OCR_COLD_START_MAX_RETRIES) {
        console.log(`[Modal] 503 (cold start), reintentando en ${OCR_COLD_START_RETRY_DELAY_MS}ms (intento ${intento + 1}/${OCR_COLD_START_MAX_RETRIES})`);
        await sleep(OCR_COLD_START_RETRY_DELAY_MS);
        continue;
      }

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        throw new ModalOcrRequestError(
          `Modal respondió ${response.status}: ${bodyText.slice(0, 500)}`,
          response.status,
        );
      }

      const json = (await response.json()) as unknown;
      return parseChatCompletionResponse(json);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ModalOcrTimeoutError(`Modal no respondió dentro de ${OCR_TIMEOUT_MS}ms`);
      }
      if (error instanceof ModalOcrRequestError || error instanceof ModalOcrConfigError) {
        throw error;
      }
      throw new ModalOcrRequestError(error instanceof Error ? error.message : "Error desconocido llamando a Modal");
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new ModalOcrRequestError(
    `Modal siguió respondiendo 503 (cold start) tras ${OCR_COLD_START_MAX_RETRIES} reintentos`,
    503,
  );
}

async function construirContenidoParaModelo(buffer: Buffer, mimeType: string): Promise<ChatContent[]> {
  const instruccion = "Extraé los datos estructurados de esta factura de proveedor según el schema.";

  if (esPdf(mimeType)) {
    const textoNativo = await extraerTextoPdf(buffer);
    if (textoNativo) {
      return [
        { type: "text", text: `${instruccion}\n\nTexto de la factura (extraído del PDF):\n\n${textoNativo}` },
      ];
    }

    // PDF escaneado sin texto nativo: rasterizamos localmente y mandamos la imagen.
    const imagenPng = await rasterizarPdf(buffer);
    return [
      { type: "text", text: instruccion },
      { type: "image_url", image_url: { url: `data:image/png;base64,${imagenPng.toString("base64")}` } },
    ];
  }

  return [
    { type: "text", text: instruccion },
    { type: "image_url", image_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}` } },
  ];
}

function parseChatCompletionResponse(json: unknown): ModalOcrResult {
  if (!json || typeof json !== "object") {
    throw new ModalOcrRequestError("Respuesta de Modal con formato inesperado");
  }
  const data = json as { choices?: Array<{ message?: { content?: unknown } }>; error?: unknown };

  if (data.error) {
    const message = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    return { status: "error", message };
  }

  const rawContent = data.choices?.[0]?.message?.content;
  if (typeof rawContent !== "string" || !rawContent.trim()) {
    throw new ModalOcrRequestError("Modal no devolvió contenido en la respuesta del chat");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new ModalOcrRequestError("Modal devolvió un contenido que no es JSON válido a pesar del json_schema");
  }

  return normalizarExtraccion(parsed, rawContent);
}

function normalizarExtraccion(parsed: unknown, ocrTextRaw: string): ModalOcrResult {
  if (!parsed || typeof parsed !== "object") {
    throw new ModalOcrRequestError("La extracción de Modal no tiene el formato esperado");
  }
  const data = parsed as Record<string, unknown>;

  const supplier = (data.supplier as Record<string, unknown> | undefined) ?? {};
  const invoice = (data.invoice as Record<string, unknown> | undefined) ?? {};
  const rawItems = Array.isArray(data.items) ? data.items : [];

  const items: ModalOcrItem[] = rawItems.map((raw) => {
    const item = raw as Record<string, unknown>;
    return {
      rawDescription: typeof item.rawDescription === "string" ? item.rawDescription : "",
      supplierCode: typeof item.supplierCode === "string" ? item.supplierCode : null,
      quantity: typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1,
      unitCost: typeof item.unitCost === "number" && Number.isFinite(item.unitCost) ? item.unitCost : null,
      lineTotal: typeof item.lineTotal === "number" && Number.isFinite(item.lineTotal) ? item.lineTotal : null,
      confidence: typeof item.confidence === "number" && Number.isFinite(item.confidence) ? item.confidence : null,
    };
  }).filter((item) => item.rawDescription.trim().length > 0);

  return {
    status: "success",
    ocrText: ocrTextRaw,
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
