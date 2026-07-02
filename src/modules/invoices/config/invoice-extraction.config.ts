// src/modules/invoices/config/invoice-extraction.config.ts
// Configuración central y declarativa de qué campos se le piden al modelo de IA
// al extraer una factura/remito/ticket de proveedor.
//
// Este archivo reemplaza prompts hardcodeados: el prompt y el JSON schema esperado
// se generan desde esta configuración, así que agregar/ajustar campos estándar
// no requiere tocar el texto del prompt a mano.
//
// Alcance deliberado:
// - Los campos fijos son genéricos para FacturaProveedor / FacturaProveedorItem.
// - El sistema es multi-rubro, pero NO cambia de schema por rubro.
// - El rubro se usa solo como hint contextual.
// - Campos específicos como lote, vencimiento, talle, color, fragancia, IMEI,
//   medida, material, sabor, etc. se capturan en extraAttributes.
// - La descripción del item se conserva cruda para trazabilidad.
// - No se inventan productos, precios, totales ni datos fiscales.

import { getAtributosTipicos, getRubroLabel } from "./rubros";

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
  | "unitCost"
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
  /**
   * Descripción del producto tal como aparece en la factura.
   * Debe ser lo más fiel posible al OCR / documento original.
   */
  rawDescription: string;

  /**
   * Código interno/SKU/código de proveedor si aparece.
   */
  supplierCode: string | null;

  /**
   * Cantidad comprada. Si el comprobante no la muestra explícitamente,
   * usar 1 solo cuando sea razonable y advertirlo en warnings.
   */
  quantity: number;

  /**
   * Costo unitario del proveedor.
   * No debe calcularse si no aparece explícitamente.
   */
  unitCost: number | null;

  /**
   * Total de línea si aparece explícitamente.
   */
  lineTotal: number | null;

  /**
   * Confianza estimada por el modelo para la línea completa.
   */
  confidence: number | null;

  /**
   * Columnas detectadas que no matchean ningún campo estándar.
   *
   * Ejemplos:
   * - perfumería: marca, línea, ml, concentración, fragancia
   * - farmacia: lote, vencimiento, laboratorio, droga
   * - indumentaria: talle, color
   * - electrónica: IMEI, número de serie, modelo
   *
   * Array en vez de objeto libre porque algunos JSON Schema strict
   * no toleran bien claves dinámicas.
   */
  extraAttributes: Array<{ key: string; value: string }>;
}

export interface ExtractedInvoiceData {
  supplier: {
    name: string | null;
    taxId: string | null;
  };
  invoice: {
    number: string | null;
    date: string | null;
    currency: string | null;
    total: number | null;
  };
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
    aliases: [
      "proveedor",
      "razón social",
      "razon social",
      "señor(es)",
      "vendedor",
      "emisor",
      "empresa",
      "nombre comercial",
      "fantasía",
      "fantasia",
      "cliente/proveedor",
    ],
    description:
      "Nombre comercial o razón social del proveedor/emisor del comprobante. No confundir con el cliente/receptor.",
    expectedType: "string",
    confidenceWeight: 1,
  },
  {
    key: "supplierTaxId",
    required: false,
    aliases: [
      "cuit",
      "cuil",
      "ruc",
      "nif",
      "rut",
      "rif",
      "nit",
      "identificación fiscal",
      "id fiscal",
      "tax id",
    ],
    description:
      "Identificador fiscal del proveedor/emisor, si aparece. Mantener guiones o formato original si están visibles.",
    expectedType: "string",
    confidenceWeight: 0.6,
  },
  {
    key: "invoiceNumber",
    required: false,
    aliases: [
      "factura n°",
      "factura nro",
      "nro. factura",
      "número de factura",
      "comprobante n°",
      "comprobante nro",
      "número",
      "numero",
      "ticket",
      "remito",
      "recibo",
      "invoice",
      "documento",
      "doc.",
    ],
    description:
      "Número del comprobante, factura, remito, ticket, orden o recibo. No usar códigos de productos como número de factura.",
    expectedType: "string",
    confidenceWeight: 0.7,
  },
  {
    key: "issueDate",
    required: false,
    aliases: [
      "fecha",
      "fecha de emisión",
      "fecha emisión",
      "fecha emision",
      "emitido",
      "emisión",
      "emision",
      "date",
      "fecha comprobante",
    ],
    description:
      "Fecha de emisión del comprobante en formato ISO 8601 YYYY-MM-DD. Si el año es ambiguo o no aparece, usar null.",
    expectedType: "date",
    confidenceWeight: 0.7,
  },
  {
    key: "currency",
    required: false,
    aliases: [
      "moneda",
      "$",
      "u$s",
      "us$",
      "usd",
      "ars",
      "eur",
      "pesos",
      "dólares",
      "dolares",
    ],
    description:
      "Moneda del comprobante como código ISO de 3 letras. Ejemplos: ARS, USD, EUR. Si hay símbolos ambiguos, inferir solo si el texto lo deja claro.",
    expectedType: "string",
    confidenceWeight: 0.3,
  },
  {
    key: "total",
    required: false,
    aliases: [
      "total",
      "total general",
      "importe total",
      "monto total",
      "total a pagar",
      "neto a pagar",
      "gran total",
      "amount due",
    ],
    description:
      "Importe total final del comprobante. No usar subtotal, descuento, IVA ni total de una sola línea como total general.",
    expectedType: "number",
    confidenceWeight: 1,
  },
];

export const INVOICE_ITEM_EXTRACTION_FIELDS: InvoiceItemFieldConfig[] = [
  {
    key: "description",
    required: true,
    aliases: [
      "descripción",
      "descripcion",
      "detalle",
      "artículo",
      "articulo",
      "producto",
      "concepto",
      "ítem",
      "item",
      "mercadería",
      "mercaderia",
      "servicio",
    ],
    description:
      "Descripción del item tal como aparece en la factura. No corregir marcas, no traducir, no resumir y no inventar faltantes.",
    expectedType: "string",
    confidenceWeight: 1,
  },
  {
    key: "supplierCode",
    required: false,
    aliases: [
      "código",
      "codigo",
      "cod.",
      "cod",
      "sku",
      "id",
      "referencia",
      "ref.",
      "cód. proveedor",
      "codigo proveedor",
      "código interno",
      "codigo interno",
      "ean",
      "barcode",
      "código de barras",
    ],
    description:
      "Código interno, SKU, referencia, EAN o código de proveedor del item. No confundir con cantidad, precio o número de factura.",
    expectedType: "string",
    confidenceWeight: 0.4,
  },
  {
    key: "quantity",
    required: true,
    aliases: [
      "cantidad",
      "cant.",
      "cant",
      "unidades",
      "uds",
      "u.",
      "qty",
      "bultos",
      "cajas",
      "packs",
    ],
    description:
      "Cantidad del item. Puede ser decimal si la factura vende por peso, litro, metro u otra unidad fraccionable.",
    expectedType: "number",
    confidenceWeight: 0.9,
  },
  {
    key: "unitCost",
    required: false,
    aliases: [
      "precio unitario",
      "p. unit.",
      "p unit",
      "precio",
      "costo",
      "costo unitario",
      "unitario",
      "valor unitario",
      "unit price",
      "precio compra",
    ],
    description:
      "Costo/precio unitario del proveedor para ese item. No calcularlo si no aparece explícitamente.",
    expectedType: "number",
    confidenceWeight: 0.8,
  },
  {
    key: "lineTotal",
    required: false,
    aliases: [
      "subtotal",
      "importe",
      "total línea",
      "total linea",
      "total item",
      "importe línea",
      "importe linea",
      "line total",
    ],
    description:
      "Subtotal o total de la línea del item. Debe corresponder a esa línea, no al total general del comprobante.",
    expectedType: "number",
    confidenceWeight: 0.6,
  },
];

const MAX_OCR_TEXT_CHARS =
  Number(process.env.OPENROUTER_MAX_INPUT_CHARS) || 12000;

const DEFAULT_CURRENCY =
  process.env.DEFAULT_INVOICE_CURRENCY?.trim().toUpperCase() || null;

export function truncateOcrText(rawText: string): string {
  if (rawText.length <= MAX_OCR_TEXT_CHARS) return rawText;
  return rawText.slice(0, MAX_OCR_TEXT_CHARS);
}

function normalizePromptRubroLabel(rubro?: string | null): string | null {
  if (!rubro) return null;
  const trimmed = rubro.trim();
  if (!trimmed) return null;
  return getRubroLabel(trimmed);
}

function buildRubroContext(rubro?: string | null): string {
  const rubroLabel = normalizePromptRubroLabel(rubro);
  if (!rubroLabel) return "";

  const atributosTipicos = getAtributosTipicos(rubro);

  return `
Contexto adicional de rubro:
- Este negocio pertenece al rubro "${rubroLabel}".
- Usá el rubro ÚNICAMENTE como ayuda contextual para interpretar nombres de productos, columnas, abreviaturas y atributos extra.
- El rubro NO cambia el JSON schema.
- El rubro NO autoriza a inventar datos.
${
  atributosTipicos
    ? `- En este rubro, si aparecen en el texto, prestá especial atención a atributos como: ${atributosTipicos}.`
    : "- No hay atributos típicos predefinidos para este rubro; extraé solo lo que aparezca claramente."
}
- Si alguno de esos atributos aparece asociado a un item y no corresponde a un campo estándar, guardalo en extraAttributes.
- Si no aparece, no lo agregues.
`;
}

/**
 * Arma el prompt de sistema dinámicamente desde la config.
 *
 * `rubro` es únicamente contexto adicional:
 * - viene de Configuracion.rubroNegocio;
 * - no cambia el schema;
 * - no cambia los campos obligatorios;
 * - no modifica la validación;
 * - no reemplaza el OCR.
 */
export function buildInvoiceExtractionPrompt(rubro?: string | null): string {
  const camposFactura = INVOICE_EXTRACTION_FIELDS.map(
    (f) =>
      `- ${f.key} (${f.expectedType}): ${f.description}. Alias posibles: ${f.aliases.join(
        ", ",
      )}.`,
  ).join("\n");

  const camposItem = INVOICE_ITEM_EXTRACTION_FIELDS.map(
    (f) =>
      `- ${f.key} (${f.expectedType}): ${f.description}. Alias posibles: ${f.aliases.join(
        ", ",
      )}.`,
  ).join("\n");

  const contextoRubro = buildRubroContext(rubro);

  const monedaDefaultHint = DEFAULT_CURRENCY
    ? `- Si el comprobante usa símbolo "$" sin aclarar moneda y el país/contexto no permite distinguirla, podés usar "${DEFAULT_CURRENCY}" solo si es la moneda por defecto configurada del sistema. Si no estás seguro, usá null.`
    : `- Si el comprobante usa símbolo "$" sin aclarar moneda y no se puede distinguir entre ARS/USD/u otra moneda, usá null.`;

  return `Sos un extractor de datos de facturas, remitos, tickets, órdenes y comprobantes de proveedores para un sistema de inventario multi-rubro.

Recibís texto plano obtenido por OCR. El texto puede venir:
- desordenado,
- con saltos de línea inconsistentes,
- con columnas corridas,
- con caracteres mal reconocidos,
- con números pegados a textos,
- con productos partidos en varias líneas,
- con totales mezclados con subtotales,
- con códigos de producto confundidos con cantidades,
- con "0" confundido con "O",
- con "1" confundido con "I" o "l",
- con "5" confundido con "S",
- con precios en formato argentino, estadounidense o mixto.

${contextoRubro}

Objetivo:
Extraer un JSON limpio, válido y estricto con:
- proveedor,
- datos generales del comprobante,
- lista de items,
- advertencias de lectura.

Reglas estrictas de salida:
- Devolvé ÚNICAMENTE JSON válido.
- No agregues texto antes ni después del JSON.
- No uses Markdown.
- No uses comentarios.
- No uses trailing commas.
- Respetá exactamente el schema esperado.
- No agregues propiedades fuera del schema.
- Si un campo no aparece o no se puede leer con confianza razonable, usá null.
- En arrays, usá [] si no hay datos.
- Las confidence deben ser números entre 0 y 1.

Reglas estrictas de no invención:
- NO inventes proveedor.
- NO inventes CUIT/RUC/NIF/RUT.
- NO inventes número de comprobante.
- NO inventes fecha.
- NO inventes moneda.
- NO inventes productos.
- NO inventes cantidades.
- NO inventes precios.
- NO inventes atributos extra.
- NO completes marcas, modelos o nombres aunque parezcan obvios.
- NO corrijas nombres comerciales salvo errores OCR extremadamente evidentes y solo si el texto lo sostiene.
- NO traduzcas descripciones.
- NO mejores redacción de productos.
- NO normalices nombres de productos a catálogo propio.

Reglas para proveedor y comprobante:
- supplier.name debe ser el proveedor/emisor, no el cliente/receptor.
- supplier.taxId debe ser el identificador fiscal del proveedor/emisor.
- invoice.number debe ser el número del comprobante, no un código de producto.
- invoice.date debe estar en formato YYYY-MM-DD.
- Si la fecha está incompleta, ambigua o sin año claro, usá null.
- invoice.total debe ser el total final del comprobante.
- No confundas subtotal, IVA, descuento, percepción, saldo anterior o total de línea con total general.
${monedaDefaultHint}

Reglas para items:
- Cada producto/servicio comprado debe ser un item separado.
- No mezcles dos productos distintos en una misma línea.
- No dividas un mismo producto en varios items si la descripción está partida por saltos de línea.
- rawDescription debe conservar la descripción del item tal como aparece, con la mayor fidelidad posible.
- Si una descripción ocupa varias líneas, unilas en una sola rawDescription manteniendo el orden.
- supplierCode debe contener código/SKU/referencia solo si aparece asociado al item.
- quantity debe ser numérico.
- quantity puede ser decimal si la unidad es kilo, litro, metro, granel o peso.
- Si el comprobante no muestra cantidad pero claramente lista un item comprado, podés usar quantity=1 y agregar un warning.
- unitCost debe ser el precio/costo unitario escrito en la factura.
- lineTotal debe ser el subtotal de la línea escrito en la factura.
- No calcules unitCost desde lineTotal/quantity.
- No calcules lineTotal desde unitCost*quantity.
- Si aparece un precio tachado, promocional, bonificado o con descuento ambiguo, elegí el precio final solo si está claro; si no, usá null y agregá warning.
- Si hay bonificaciones o descuentos por línea y no hay un precio final claro, preservá lo visible en extraAttributes o warnings.

Reglas para extraAttributes:
- Usá extraAttributes para columnas o datos asociados al item que no sean:
  rawDescription, supplierCode, quantity, unitCost, lineTotal.
- Ejemplos de claves válidas:
  marca, modelo, línea, fragancia, presentación, ml, lote, vencimiento, talle, color, material, unidad, peso, volumen, envase, bulto, caja, pack, sabor, concentración, laboratorio, principio activo, IMEI, número de serie, medida, diámetro, largo, ancho, alto.
- Las claves deben ser cortas, en español, consistentes y en minúsculas cuando sea posible.
- Los valores deben ser strings.
- No agregues extraAttributes si el dato no aparece en el texto.
- No uses extraAttributes para guardar datos generales de la factura.
- Si el dato parece pertenecer al producto pero no sabés la clave exacta, usá una clave simple como "atributo" solo como último recurso.

Reglas para OCR difícil:
- Si una línea parece producto pero está muy dañada, extraela solo si se puede identificar razonablemente la descripción.
- Si el OCR duplicó una línea de producto, no la dupliques salvo que haya evidencia de dos unidades/líneas reales.
- Si aparecen columnas mal alineadas, priorizá la coherencia entre descripción, cantidad, precio unitario y total de línea.
- Si un número puede ser código de producto o precio, decidí por contexto; si no hay contexto suficiente, no lo fuerces.
- Si hay páginas o secciones cortadas, agregá warning.
- Si la tabla de items no es reconocible, devolvé items=[].
- Si el total no coincide con la suma visible de items, agregá warning y no corrijas el total.
- Si no hay totales visibles, invoice.total debe ser null.

Campos del comprobante a extraer:
${camposFactura}

Campos por cada item de la lista "items":
${camposItem}

Formato conceptual esperado:
{
  "supplier": {
    "name": string | null,
    "taxId": string | null
  },
  "invoice": {
    "number": string | null,
    "date": string | null,
    "currency": string | null,
    "total": number | null
  },
  "items": [
    {
      "rawDescription": string,
      "supplierCode": string | null,
      "quantity": number,
      "unitCost": number | null,
      "lineTotal": number | null,
      "confidence": number,
      "extraAttributes": [
        { "key": string, "value": string }
      ]
    }
  ],
  "warnings": string[]
}

Criterio de confidence:
- 0.90 a 1.00: lectura clara, línea consistente.
- 0.70 a 0.89: lectura razonable con dudas menores.
- 0.40 a 0.69: lectura parcial, columnas dudosas o texto dañado.
- 0.00 a 0.39: muy baja confianza; usar solo si el dato es necesario y visible parcialmente.
- Si una línea requiere revisión humana, bajá confidence y agregá warning.

"warnings" debe ser una lista corta de problemas concretos.
Ejemplos:
- "No se pudo identificar moneda con seguridad"
- "Cantidad asumida como 1 en algunos items sin columna visible"
- "Zona de totales borrosa o incompleta"
- "Posible descripción de item cortada"
- "El total no coincide con la suma visible de los items"
- "Tabla de productos con columnas desalineadas por OCR"`;
}

export function buildExpectedOutputSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      supplier: {
        type: "object",
        properties: {
          name: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          taxId: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
        },
        required: ["name", "taxId"],
        additionalProperties: false,
      },
      invoice: {
        type: "object",
        properties: {
          number: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          date: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          currency: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          total: {
            anyOf: [{ type: "number" }, { type: "null" }],
          },
        },
        required: ["number", "date", "currency", "total"],
        additionalProperties: false,
      },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rawDescription: {
              type: "string",
            },
            supplierCode: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
            quantity: {
              type: "number",
            },
            unitCost: {
              anyOf: [{ type: "number" }, { type: "null" }],
            },
            lineTotal: {
              anyOf: [{ type: "number" }, { type: "null" }],
            },
            confidence: {
              anyOf: [{ type: "number" }, { type: "null" }],
            },
            extraAttributes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: {
                    type: "string",
                  },
                  value: {
                    type: "string",
                  },
                },
                required: ["key", "value"],
                additionalProperties: false,
              },
            },
          },
          required: [
            "rawDescription",
            "supplierCode",
            "quantity",
            "unitCost",
            "lineTotal",
            "confidence",
            "extraAttributes",
          ],
          additionalProperties: false,
        },
      },
      warnings: {
        type: "array",
        items: {
          type: "string",
        },
      },
    },
    required: ["supplier", "invoice", "items", "warnings"],
    additionalProperties: false,
  };
}

/**
 * Valida la forma mínima del JSON devuelto por el modelo antes de confiar en él.
 *
 * Esta validación no reemplaza una validación completa con Zod/Ajv, pero sirve
 * como defensa rápida antes de persistir o mandar a matching-engine.ts.
 */
export function validateExtractedInvoice(data: unknown): InvoiceValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return {
      valid: false,
      errors: ["La respuesta no es un objeto JSON"],
    };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.supplier || typeof obj.supplier !== "object" || Array.isArray(obj.supplier)) {
    errors.push("Falta 'supplier' o no es un objeto");
  } else {
    const supplier = obj.supplier as Record<string, unknown>;

    if (!("name" in supplier)) errors.push("Falta 'supplier.name'");
    if (!("taxId" in supplier)) errors.push("Falta 'supplier.taxId'");

    if (
      supplier.name !== null &&
      supplier.name !== undefined &&
      typeof supplier.name !== "string"
    ) {
      errors.push("'supplier.name' debe ser string o null");
    }

    if (
      supplier.taxId !== null &&
      supplier.taxId !== undefined &&
      typeof supplier.taxId !== "string"
    ) {
      errors.push("'supplier.taxId' debe ser string o null");
    }
  }

  if (!obj.invoice || typeof obj.invoice !== "object" || Array.isArray(obj.invoice)) {
    errors.push("Falta 'invoice' o no es un objeto");
  } else {
    const invoice = obj.invoice as Record<string, unknown>;

    if (!("number" in invoice)) errors.push("Falta 'invoice.number'");
    if (!("date" in invoice)) errors.push("Falta 'invoice.date'");
    if (!("currency" in invoice)) errors.push("Falta 'invoice.currency'");
    if (!("total" in invoice)) errors.push("Falta 'invoice.total'");

    if (
      invoice.number !== null &&
      invoice.number !== undefined &&
      typeof invoice.number !== "string"
    ) {
      errors.push("'invoice.number' debe ser string o null");
    }

    if (
      invoice.date !== null &&
      invoice.date !== undefined &&
      typeof invoice.date !== "string"
    ) {
      errors.push("'invoice.date' debe ser string o null");
    }

    if (
      invoice.currency !== null &&
      invoice.currency !== undefined &&
      typeof invoice.currency !== "string"
    ) {
      errors.push("'invoice.currency' debe ser string o null");
    }

    if (
      invoice.total !== null &&
      invoice.total !== undefined &&
      typeof invoice.total !== "number"
    ) {
      errors.push("'invoice.total' debe ser number o null");
    }
  }

  if (!Array.isArray(obj.items)) {
    errors.push("'items' debe ser un array");
  } else {
    obj.items.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`'items[${index}]' debe ser un objeto`);
        return;
      }

      const itemObj = item as Record<string, unknown>;

      if (typeof itemObj.rawDescription !== "string") {
        errors.push(`'items[${index}].rawDescription' debe ser string`);
      }

      if (
        itemObj.supplierCode !== null &&
        itemObj.supplierCode !== undefined &&
        typeof itemObj.supplierCode !== "string"
      ) {
        errors.push(`'items[${index}].supplierCode' debe ser string o null`);
      }

      if (typeof itemObj.quantity !== "number" || Number.isNaN(itemObj.quantity)) {
        errors.push(`'items[${index}].quantity' debe ser number`);
      }

      if (
        itemObj.unitCost !== null &&
        itemObj.unitCost !== undefined &&
        (typeof itemObj.unitCost !== "number" || Number.isNaN(itemObj.unitCost))
      ) {
        errors.push(`'items[${index}].unitCost' debe ser number o null`);
      }

      if (
        itemObj.lineTotal !== null &&
        itemObj.lineTotal !== undefined &&
        (typeof itemObj.lineTotal !== "number" || Number.isNaN(itemObj.lineTotal))
      ) {
        errors.push(`'items[${index}].lineTotal' debe ser number o null`);
      }

      if (
        itemObj.confidence !== null &&
        itemObj.confidence !== undefined &&
        (typeof itemObj.confidence !== "number" ||
          Number.isNaN(itemObj.confidence) ||
          itemObj.confidence < 0 ||
          itemObj.confidence > 1)
      ) {
        errors.push(`'items[${index}].confidence' debe ser number entre 0 y 1 o null`);
      }

      if (!Array.isArray(itemObj.extraAttributes)) {
        errors.push(`'items[${index}].extraAttributes' debe ser array`);
      } else {
        itemObj.extraAttributes.forEach((attr, attrIndex) => {
          if (!attr || typeof attr !== "object" || Array.isArray(attr)) {
            errors.push(
              `'items[${index}].extraAttributes[${attrIndex}]' debe ser objeto`,
            );
            return;
          }

          const attrObj = attr as Record<string, unknown>;

          if (typeof attrObj.key !== "string") {
            errors.push(
              `'items[${index}].extraAttributes[${attrIndex}].key' debe ser string`,
            );
          }

          if (typeof attrObj.value !== "string") {
            errors.push(
              `'items[${index}].extraAttributes[${attrIndex}].value' debe ser string`,
            );
          }
        });
      }
    });
  }

  if (!Array.isArray(obj.warnings)) {
    errors.push("'warnings' debe ser un array");
  } else {
    obj.warnings.forEach((warning, index) => {
      if (typeof warning !== "string") {
        errors.push(`'warnings[${index}]' debe ser string`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Confianza global de la extracción.
 *
 * Es informativa:
 * - sirve para auditoría,
 * - ranking,
 * - UI,
 * - logs,
 * - decisión de revisión manual.
 *
 * No debería ser el único gate para guardar: el matching real conviene hacerlo
 * a nivel de item en matching-engine.ts.
 */
export function calculateInvoiceConfidence(data: ExtractedInvoiceData): number {
  const pesos: Array<[unknown, number]> = [
    [
      data.supplier.name,
      INVOICE_EXTRACTION_FIELDS.find((f) => f.key === "supplierName")!
        .confidenceWeight,
    ],
    [
      data.supplier.taxId,
      INVOICE_EXTRACTION_FIELDS.find((f) => f.key === "supplierTaxId")!
        .confidenceWeight,
    ],
    [
      data.invoice.number,
      INVOICE_EXTRACTION_FIELDS.find((f) => f.key === "invoiceNumber")!
        .confidenceWeight,
    ],
    [
      data.invoice.date,
      INVOICE_EXTRACTION_FIELDS.find((f) => f.key === "issueDate")!
        .confidenceWeight,
    ],
    [
      data.invoice.currency,
      INVOICE_EXTRACTION_FIELDS.find((f) => f.key === "currency")!
        .confidenceWeight,
    ],
    [
      data.invoice.total,
      INVOICE_EXTRACTION_FIELDS.find((f) => f.key === "total")!
        .confidenceWeight,
    ],
  ];

  const sumaPesos = pesos.reduce((acc, [, peso]) => acc + peso, 0);

  const puntajeCabecera = pesos.reduce((acc, [valor, peso]) => {
    const tieneValor =
      valor !== null &&
      valor !== undefined &&
      !(typeof valor === "string" && valor.trim() === "");

    return acc + (tieneValor ? peso : 0);
  }, 0);

  const confianzaCabecera = sumaPesos > 0 ? puntajeCabecera / sumaPesos : 0;

  const confidencesItems = data.items
    .map((i) => i.confidence)
    .filter((c): c is number => typeof c === "number" && !Number.isNaN(c));

  const confianzaItems =
    confidencesItems.length > 0
      ? confidencesItems.reduce((a, b) => a + b, 0) / confidencesItems.length
      : confianzaCabecera;

  return data.items.length > 0
    ? roundConfidence((confianzaCabecera + confianzaItems) / 2)
    : roundConfidence(confianzaCabecera);
}

function roundConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}