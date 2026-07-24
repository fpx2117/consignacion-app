// src/lib/ai/openrouter-client.ts
// Cliente de bajo nivel hacia OpenRouter (https://openrouter.ai) — API compatible
// con OpenAI chat/completions, pero facturada por tokens (no por GPU/tiempo
// encendida como Modal). Por defecto sólo se manda texto, para mantener el costo
// por factura predecible y bajo. Excepción: fallback de visión (parámetro
// `images`, ver invoice-ai-parser.ts) cuando el OCR local no alcanza — ahí sí se
// manda la imagen, con un modelo y costo distintos (OPENROUTER_VISION_MODEL).

const OPENROUTER_BASE_URL = (
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"
).replace(/\/$/, "");
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
// Modelo separado para el fallback de visión (ver invoice-ai-parser.ts): independiente
// de OPENROUTER_MODEL a propósito, para que el camino texto-only pueda apuntar a un
// modelo más barato sin depender de que ese modelo también soporte imágenes.
const OPENROUTER_VISION_MODEL =
  process.env.OPENROUTER_VISION_MODEL || "openai/gpt-4o-mini";
// 150s: medido contra facturas reales, la latencia de qwen3.6-35b-a3b sin
// reasoning varía bastante según a qué proveedor upstream de OpenRouter te
// toque (AtlasCloud, Parasail, etc.) y según qué tan "sucio" salga el texto
// OCR de una foto vs. un PDF con texto nativo. Se deja margen generoso acá
// porque el costo de esperar de más es mucho menor que el de un 502.
const OPENROUTER_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS) || 150000;
const OPENROUTER_MAX_TOKENS = Number(process.env.OCR_MAX_TOKENS) || 8000;
// Reasoning apagado por defecto: medido contra una factura de 20 items, con
// reasoning (incluso "low") tarda 100-145s y quema miles de tokens pensando
// para una tarea de extracción estructurada que no lo necesita — con
// effort "none" el mismo caso baja a ~49s y sale más barato, sin perder
// precisión (json_schema strict ya fuerza la forma de la respuesta). Se puede
// reactivar seteando OPENROUTER_REASONING_EFFORT a "low"/"medium"/"high" si
// hiciera falta para facturas particularmente difíciles de leer.
const VALID_REASONING_EFFORTS = [
  "max",
  "xhigh",
  "high",
  "medium",
  "low",
  "minimal",
  "none",
] as const;
const OPENROUTER_REASONING_EFFORT = resolveReasoningEffort(
  process.env.OPENROUTER_REASONING_EFFORT,
);

function resolveReasoningEffort(
  raw: string | undefined,
): (typeof VALID_REASONING_EFFORTS)[number] {
  const normalizado = (raw || "none").trim().toLowerCase();
  if ((VALID_REASONING_EFFORTS as readonly string[]).includes(normalizado)) {
    return normalizado as (typeof VALID_REASONING_EFFORTS)[number];
  }
  console.warn(
    `[OpenRouter] OPENROUTER_REASONING_EFFORT="${raw}" no es válido, usando "none"`,
  );
  return "none";
}

export class OpenRouterConfigError extends Error {}
export class OpenRouterTimeoutError extends Error {}
export class OpenRouterRequestError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
  }
}

export type OpenRouterUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  reasoningTokens: number | null;
};

export type OpenRouterChatResult = {
  content: string;
  usage: OpenRouterUsage | null;
  model: string;
};

export type OpenRouterImageInput = {
  mimeType: string;
  base64: string;
};

/**
 * Llama a chat/completions pidiendo JSON estructurado. No reintenta en caso de
 * rate limit (429) — a diferencia de Modal, acá no hay cold start que esperar;
 * un 429 se reporta como error para que el usuario reintente manualmente.
 */
export async function callOpenRouterJson(input: {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  /** Fallback de visión (facturas ilegibles para el OCR local): cuando se pasan
   * imágenes, se manda el userPrompt + las imágenes juntos en un único mensaje
   * multimodal, y se usa OPENROUTER_VISION_MODEL en vez de OPENROUTER_MODEL. */
  images?: OpenRouterImageInput[];
}): Promise<OpenRouterChatResult> {
  if (!OPENROUTER_API_KEY) {
    throw new OpenRouterConfigError(
      "OPENROUTER_API_KEY no está configurada en este entorno.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
  const startedAt = Date.now();

  const responseFormat = input.jsonSchema
    ? {
        type: "json_schema" as const,
        json_schema: {
          name: input.jsonSchema.name,
          schema: input.jsonSchema.schema,
          strict: true,
        },
      }
    : { type: "json_object" as const };

  const usedVision = Boolean(input.images?.length);
  const model = usedVision ? OPENROUTER_VISION_MODEL : OPENROUTER_MODEL;
  const userContent = usedVision
    ? [
        { type: "text" as const, text: input.userPrompt },
        ...input.images!.map((img) => ({
          type: "image_url" as const,
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        })),
      ]
    : input.userPrompt;

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: OPENROUTER_MAX_TOKENS,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: responseFormat,
        // OpenRouter valida "effort" contra un enum fijo (max/xhigh/high/medium/
        // low/minimal/none) — "none" es un valor válido de esa lista, no hace
        // falta (ni funciona) un campo "enabled" separado.
        reasoning: { effort: OPENROUTER_REASONING_EFFORT },
      }),
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new OpenRouterRequestError(
        "OpenRouter devolvió 429 (rate limit). Reintentá en unos segundos.",
        429,
      );
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new OpenRouterRequestError(
        `OpenRouter respondió ${response.status}: ${bodyText.slice(0, 500)}`,
        response.status,
      );
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        completion_tokens_details?: { reasoning_tokens?: number };
      };
      model?: string;
      error?: unknown;
    };

    if (json.error) {
      const message =
        typeof json.error === "string"
          ? json.error
          : JSON.stringify(json.error);
      throw new OpenRouterRequestError(
        `OpenRouter reportó un error: ${message}`,
      );
    }

    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new OpenRouterRequestError(
        "OpenRouter no devolvió contenido en la respuesta del chat",
      );
    }

    console.log("[OpenRouter]", {
      model: json.model || model,
      elapsedMs: Date.now() - startedAt,
      reasoningTokens:
        json.usage?.completion_tokens_details?.reasoning_tokens ?? null,
      totalTokens: json.usage?.total_tokens ?? null,
      usedVision,
    });

    return {
      content,
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens ?? null,
            completionTokens: json.usage.completion_tokens ?? null,
            totalTokens: json.usage.total_tokens ?? null,
            reasoningTokens:
              json.usage.completion_tokens_details?.reasoning_tokens ?? null,
          }
        : null,
      model: json.model || model,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.error("[OpenRouter] timeout", {
        elapsedMs: Date.now() - startedAt,
        limitMs: OPENROUTER_TIMEOUT_MS,
      });
      throw new OpenRouterTimeoutError(
        `OpenRouter no respondió dentro de ${OPENROUTER_TIMEOUT_MS}ms`,
      );
    }
    if (
      error instanceof OpenRouterRequestError ||
      error instanceof OpenRouterConfigError
    ) {
      throw error;
    }
    throw new OpenRouterRequestError(
      error instanceof Error
        ? error.message
        : "Error desconocido llamando a OpenRouter",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function parseJsonContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new OpenRouterRequestError(
      "OpenRouter devolvió un contenido que no es JSON válido",
    );
  }
}
