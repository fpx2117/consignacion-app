// src/lib/ai/openrouter-client.ts
// Cliente de bajo nivel hacia OpenRouter (https://openrouter.ai) — API compatible
// con OpenAI chat/completions, pero facturada por tokens (no por GPU/tiempo
// encendida como Modal). Sólo se le manda texto, nunca imágenes/PDFs, para
// mantener el costo por factura predecible y bajo.

const OPENROUTER_BASE_URL = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const OPENROUTER_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS) || 45000;
const OPENROUTER_MAX_TOKENS = Number(process.env.OCR_MAX_TOKENS) || 4096;
// "low" alcanza para estructurar texto ya extraído por OCR — los tokens de
// reasoning se facturan igual que los de salida, así que no vale la pena un
// esfuerzo mayor acá (no es una tarea de razonamiento complejo).
const OPENROUTER_REASONING_EFFORT = process.env.OPENROUTER_REASONING_EFFORT || "low";

export class OpenRouterConfigError extends Error {}
export class OpenRouterTimeoutError extends Error {}
export class OpenRouterRequestError extends Error {
  constructor(message: string, readonly httpStatus?: number) {
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

/**
 * Llama a chat/completions pidiendo JSON estructurado. No reintenta en caso de
 * rate limit (429) — a diferencia de Modal, acá no hay cold start que esperar;
 * un 429 se reporta como error para que el usuario reintente manualmente.
 */
export async function callOpenRouterJson(input: {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}): Promise<OpenRouterChatResult> {
  if (!OPENROUTER_API_KEY) {
    throw new OpenRouterConfigError("OPENROUTER_API_KEY no está configurada en este entorno.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  const responseFormat = input.jsonSchema
    ? { type: "json_schema" as const, json_schema: { name: input.jsonSchema.name, schema: input.jsonSchema.schema, strict: true } }
    : { type: "json_object" as const };

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature: 0,
        max_tokens: OPENROUTER_MAX_TOKENS,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
        response_format: responseFormat,
        reasoning: { effort: OPENROUTER_REASONING_EFFORT },
      }),
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new OpenRouterRequestError("OpenRouter devolvió 429 (rate limit). Reintentá en unos segundos.", 429);
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new OpenRouterRequestError(`OpenRouter respondió ${response.status}: ${bodyText.slice(0, 500)}`, response.status);
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
      const message = typeof json.error === "string" ? json.error : JSON.stringify(json.error);
      throw new OpenRouterRequestError(`OpenRouter reportó un error: ${message}`);
    }

    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new OpenRouterRequestError("OpenRouter no devolvió contenido en la respuesta del chat");
    }

    return {
      content,
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens ?? null,
            completionTokens: json.usage.completion_tokens ?? null,
            totalTokens: json.usage.total_tokens ?? null,
            reasoningTokens: json.usage.completion_tokens_details?.reasoning_tokens ?? null,
          }
        : null,
      model: json.model || OPENROUTER_MODEL,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new OpenRouterTimeoutError(`OpenRouter no respondió dentro de ${OPENROUTER_TIMEOUT_MS}ms`);
    }
    if (error instanceof OpenRouterRequestError || error instanceof OpenRouterConfigError) {
      throw error;
    }
    throw new OpenRouterRequestError(error instanceof Error ? error.message : "Error desconocido llamando a OpenRouter");
  } finally {
    clearTimeout(timeout);
  }
}

export function parseJsonContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new OpenRouterRequestError("OpenRouter devolvió un contenido que no es JSON válido");
  }
}
