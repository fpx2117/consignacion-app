import assert from "node:assert/strict";
import test from "node:test";
import { isInvalidModelError, normalizeModelId } from "./openrouter-client";

const FALLBACK = "openai/gpt-4o-mini";

test("normaliza IDs de modelo leídos de entorno", () => {
  assert.equal(
    normalizeModelId(" mistralai/mistral-small-3.2-24b-instruct ", FALLBACK),
    "mistralai/mistral-small-3.2-24b-instruct",
  );
  // Valor pegado desde un panel con comilla de apertura y sin cierre.
  assert.equal(
    normalizeModelId('"mistralai/mistral-small-3.2-24b-instruct2', FALLBACK),
    "mistralai/mistral-small-3.2-24b-instruct2",
  );
  assert.equal(normalizeModelId('"openai/gpt-4o-mini"', FALLBACK), "openai/gpt-4o-mini");
  assert.equal(normalizeModelId("'openai/gpt-4o-mini'", FALLBACK), "openai/gpt-4o-mini");
  assert.equal(normalizeModelId("   ", FALLBACK), FALLBACK);
  assert.equal(normalizeModelId("", FALLBACK), FALLBACK);
  assert.equal(normalizeModelId(undefined, FALLBACK), FALLBACK);
  assert.equal(normalizeModelId('""', FALLBACK), FALLBACK);
});

test("reconoce el rechazo de OpenRouter por modelo inexistente", () => {
  const realBody = JSON.stringify({
    error: {
      message: '"mistralai/mistral-small-3.2-24b-instruct2 is not a valid model ID',
      code: 400,
    },
    user_id: "user_3FtKcgoyyp8yTaew0a1p4FCnc6x",
  });
  assert.equal(isInvalidModelError(realBody), true);
  assert.equal(
    isInvalidModelError("OpenRouter respondió 400: model not found"),
    false,
  );
  assert.equal(isInvalidModelError(""), false);
});
