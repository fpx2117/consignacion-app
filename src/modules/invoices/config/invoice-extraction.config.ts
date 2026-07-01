// src/modules/invoices/config/invoice-extraction.config.ts
// Configuración central y declarativa de qué campos se le piden al modelo de IA
// al extraer una factura de proveedor. Reemplaza el prompt hardcodeado que tenía
// el cliente de Modal — acá el prompt y el JSON schema esperado se generan a
// partir de esta config, así que agregar/ajustar un campo no requiere tocar el
// texto del prompt a mano.
//
// Alcance deliberado: los campos definidos abajo son exactamente los que
// persisten `FacturaProveedor`/`FacturaProveedorItem` (prisma/schema.prisma).
// No se modelan campos como impuestos desglosados, descuentos, lote o
// vencimiento porque el schema actual no tiene columnas para guardarlos — antes
// de agregarlos acá hay que extender el modelo Prisma (ver TODO al final).
// Es genérico entre rubros (perfumería, kiosco, farmacia, indumentaria...)
// porque ninguno de estos campos es específico de un rubro: la extracción no
// asume IVA, ni CUIT, ni tabla de items perfecta — todos son opcionales salvo
// la descripción del item.

export type InvoiceFieldKey =
  | "supplierName"
  | "supplierTaxId"
  | "invoiceNumber"
  | "issueDate"
  | "currency"
  | "total";

export type InvoiceItemFieldKey =
  | "description"
  | "supplierCode"
  | "quantity"
  | "unitPrice"
  | "lineTotal";

export interface InvoiceExtractionFieldConfig {
  key: InvoiceFieldKey;
  required: boolean;
  aliases: string[];
  description: string;
  expectedType: "string" | "number" | "date";
  confidenceWeight: number;
}

export interface InvoiceItemFieldConfig {
  key: InvoiceItemFieldKey;
  required: boolean;
  aliases: string[];
  description: string;
  expectedType: "string" | "number";
  confidenceWeight: number;
}

export interface ExtractedField<T = unknown> {
  value: T | null;
  confidence: number;
  needsReview: boolean;
}

export interface ExtractedInvoiceItem {
  rawDescription: string;
  supplierCode: string | null;
  quantity: number;
  unitCost: number | null;
  lineTotal: number | null;
  confidence: number | null;
}

export interface ExtractedInvoiceData {
  supplier: { name: string | null; taxId: string | null };
  invoice: { number: string | null; date: string | null; currency: string | null; total: number | null };
  items: ExtractedInvoiceItem[];
  warnings: string[];
}

export interface InvoiceValidationResult {
  valid: boolean;
  errors: string[];
}

export const INVOICE_EXTRACTION_FIELDS: InvoiceExtractionFieldConfig[] = [
  {
    key: "supplierName",
    required: false,
    aliases: ["proveedor", "razón social", "razon social", "señor(es)", "vendedor"],
    description: "Nombre o razón social del proveedor que emite el comprobante",
    expectedType: "string",
    confidenceWeight: 1,
  },
  {
    key: "supplierTaxId",
    required: false,
    aliases: ["cuit", "cuil", "ruc", "nif", "rut"],
    description: "Identificador fiscal del proveedor (CUIT/CUIL/RUC/NIF), si aparece",
    expectedType: "string",
    confidenceWeight: 0.6,
  },
  {
    key: "invoiceNumber",
    required: false,
    aliases: ["factura n°", "nro. factura", "comprobante n°", "número"],
    description: "Número del comprobante (factura, remito, ticket, etc.)",
    expectedType: "string",
    confidenceWeight: 0.7,
  },
  {
    key: "issueDate",
    required: false,
    aliases: ["fecha", "fecha de emisión", "fecha emisión"],
    description: "Fecha de emisión del comprobante en formato ISO 8601 (YYYY-MM-DD)",
    expectedType: "date",
    confidenceWeight: 0.7,
  },
  {
    key: "currency",
    required: false,
    aliases: ["moneda", "$", "u$s", "usd", "ars"],
    description: "Moneda del comprobante (código ISO de 3 letras, ej. ARS, USD)",
    expectedType: "string",
    confidenceWeight: 0.3,
  },
  {
    key: "total",
    required: false,
    aliases: ["total", "total general", "importe total"],
    description: "Importe total del comprobante (no un subtotal parcial)",
    expectedType: "number",
    confidenceWeight: 1,
  },
];

export const INVOICE_ITEM_EXTRACTION_FIELDS: InvoiceItemFieldConfig[] = [
  {
    key: "description",
    required: true,
    aliases: ["descripción", "detalle", "artículo", "producto"],
    description: "Descripción del item tal como aparece en la factura, sin corregir ni traducir",
    expectedType: "string",
    confidenceWeight: 1,
  },
  {
    key: "supplierCode",
    required: false,
    aliases: ["código", "cod.", "sku"],
    description: "Código interno del proveedor para este item, si aparece",
    expectedType: "string",
    confidenceWeight: 0.4,
  },
  {
    key: "quantity",
    required: true,
    aliases: ["cantidad", "cant.", "unidades"],
    description: "Cantidad de unidades del item",
    expectedType: "number",
    confidenceWeight: 0.9,
  },
  {
    key: "unitPrice",
    required: false,
    aliases: ["precio unitario", "p. unit.", "precio"],
    description: "Precio unitario del item (sin impuestos si se puede distinguir)",
    expectedType: "number",
    confidenceWeight: 0.8,
  },
  {
    key: "lineTotal",
    required: false,
    aliases: ["subtotal", "importe", "total línea"],
    description: "Subtotal de la línea (cantidad × precio unitario), si aparece explícito",
    expectedType: "number",
    confidenceWeight: 0.6,
  },
];

const MAX_OCR_TEXT_CHARS = Number(process.env.OPENROUTER_MAX_INPUT_CHARS) || 12000;

export function truncateOcrText(rawText: string): string {
  if (rawText.length <= MAX_OCR_TEXT_CHARS) return rawText;
  return rawText.slice(0, MAX_OCR_TEXT_CHARS);
}

/**
 * Arma el prompt de sistema dinámicamente desde la config — nada de JSON de
 * ejemplo hardcodeado en un string suelto: los campos y sus alias vienen de
 * INVOICE_EXTRACTION_FIELDS / INVOICE_ITEM_EXTRACTION_FIELDS.
 */
export function buildInvoiceExtractionPrompt(): string {
  const camposFactura = INVOICE_EXTRACTION_FIELDS
    .map((f) => `- ${f.key} (${f.expectedType}): ${f.description}. Alias posibles en el texto: ${f.aliases.join(", ")}.`)
    .join("\n");
  const camposItem = INVOICE_ITEM_EXTRACTION_FIELDS
    .map((f) => `- ${f.key} (${f.expectedType}): ${f.description}. Alias posibles: ${f.aliases.join(", ")}.`)
    .join("\n");

  return `Sos un extractor de datos de facturas/comprobantes de proveedores para un sistema de inventario multi-rubro (perfumería, farmacia, kiosco, almacén, supermercado, indumentaria, ferretería, distribuidora, librería, servicios, etc.).

Recibís texto plano obtenido por OCR, posiblemente desordenado, con saltos de línea inconsistentes y errores de reconocimiento de caracteres.

Reglas estrictas:
- Devolvé ÚNICAMENTE JSON válido, sin texto adicional antes o después.
- NO inventes datos que no estén en el texto. Si un campo no aparece o no se puede leer con confianza razonable, su value debe ser null.
- Si un campo es dudoso (letra poco clara, formato ambiguo), asigná confidence bajo.
- Conservá las descripciones de items TAL COMO aparecen en el texto — no las traduzcas, no las "mejores", no las acortes.
- No mezcles dos productos en una sola línea de item.
- No calcules ni infieras precios que no estén escritos.
- Si el total no coincide con la suma de los items, agregalo como observación en "warnings", no lo corrijas vos.
- Si no hay una tabla de items reconocible, devolvé items=[] — no inventes items.
- No asumas que el comprobante tiene IVA, CUIT o packaging físico: muchos rubros (servicios, por ejemplo) no los tienen.

Campos del comprobante a extraer:
${camposFactura}

Campos por cada item de la lista "items":
${camposItem}

"confidence" en cada item es tu propia estimación (0 a 1) de qué tan seguro estás de haber leído bien esa línea completa. "warnings" es una lista corta de problemas notados (ej: "factura borrosa en la zona de totales", "posible línea cortada al final").`;
}

export function buildExpectedOutputSchema(): Record<string, unknown> {
  return {
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
  };
}

/** Valida la forma mínima del JSON devuelto por el modelo antes de confiar en él. */
export function validateExtractedInvoice(data: unknown): InvoiceValidationResult {
  const errors: string[] = [];
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["La respuesta no es un objeto JSON"] };
  }
  const obj = data as Record<string, unknown>;

  if (!obj.supplier || typeof obj.supplier !== "object") errors.push("Falta 'supplier'");
  if (!obj.invoice || typeof obj.invoice !== "object") errors.push("Falta 'invoice'");
  if (!Array.isArray(obj.items)) errors.push("'items' debe ser un array");
  if (!Array.isArray(obj.warnings)) errors.push("'warnings' debe ser un array");

  return { valid: errors.length === 0, errors };
}

/**
 * Confianza global de la extracción, ponderada por confidenceWeight de cada
 * campo de cabecera más el promedio de confidence de los items. Es informativa
 * (queda en auditoría) — no bloquea el guardado: el gate real de "requiere
 * revisión" lo hace matching-engine.ts a nivel de cada item.
 */
export function calculateInvoiceConfidence(data: ExtractedInvoiceData): number {
  const pesos: Array<[unknown, number]> = [
    [data.supplier.name, INVOICE_EXTRACTION_FIELDS.find((f) => f.key === "supplierName")!.confidenceWeight],
    [data.supplier.taxId, INVOICE_EXTRACTION_FIELDS.find((f) => f.key === "supplierTaxId")!.confidenceWeight],
    [data.invoice.number, INVOICE_EXTRACTION_FIELDS.find((f) => f.key === "invoiceNumber")!.confidenceWeight],
    [data.invoice.date, INVOICE_EXTRACTION_FIELDS.find((f) => f.key === "issueDate")!.confidenceWeight],
    [data.invoice.total, INVOICE_EXTRACTION_FIELDS.find((f) => f.key === "total")!.confidenceWeight],
  ];

  const sumaPesos = pesos.reduce((acc, [, peso]) => acc + peso, 0);
  const puntajeCabecera = pesos.reduce((acc, [valor, peso]) => acc + (valor !== null && valor !== undefined ? peso : 0), 0);
  const confianzaCabecera = sumaPesos > 0 ? puntajeCabecera / sumaPesos : 0;

  const confidencesItems = data.items.map((i) => i.confidence).filter((c): c is number => typeof c === "number");
  const confianzaItems = confidencesItems.length > 0
    ? confidencesItems.reduce((a, b) => a + b, 0) / confidencesItems.length
    : confianzaCabecera;

  // Cabecera y items pesan igual salvo que no haya items (factura sin tabla reconocible).
  return data.items.length > 0 ? (confianzaCabecera + confianzaItems) / 2 : confianzaCabecera;
}

// TODO: si en el futuro se necesita modelar impuestos desglosados, descuentos,
// lote/vencimiento o itemType (PRODUCT/SERVICE), primero hay que agregar esas
// columnas a FacturaProveedor/FacturaProveedorItem en prisma/schema.prisma —
// después se extiende esta config y el prompt para pedirlas.
