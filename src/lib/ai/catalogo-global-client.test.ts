import assert from "node:assert/strict";
import test from "node:test";
import { buscarCandidatosGlobales } from "./catalogo-global-client";

const ENV_KEYS = [
  "CATALOGO_API_URL",
  "CATALOGO_API_KEY",
  "CATALOGO_API_TIMEOUT_MS",
] as const;

async function withEnv(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string>>,
  run: () => Promise<void>,
) {
  const previous: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) previous[key] = process.env[key];
  for (const key of ENV_KEYS) {
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    await run();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

async function withFetch(mock: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("sin CATALOGO_API_URL configurada, devuelve [] sin llamar a fetch", async () => {
  await withEnv({}, async () => {
    let llamado = false;
    await withFetch(
      (async () => {
        llamado = true;
        throw new Error("no debería llamarse");
      }) as typeof fetch,
      async () => {
        const resultado = await buscarCandidatosGlobales({
          rubro: "kiosco",
          descripcion: "COCA-COLA 8x2,25",
        });
        assert.deepEqual(resultado, []);
        assert.equal(llamado, false);
      },
    );
  });
});

test("respuesta OK devuelve los candidatos tal cual", async () => {
  await withEnv(
    { CATALOGO_API_URL: "https://catalogo.test", CATALOGO_API_KEY: "clave" },
    async () => {
      const candidatos = [
        {
          id: "1",
          codigoBarras: "7790895000998",
          nombreNormalizado: "Coca-Cola 2.25L",
          marca: "Coca-Cola",
          presentacion: "2.25 L",
          categoria: "Bebidas",
          score: 94,
        },
      ];
      await withFetch(
        (async (url: string, init: RequestInit) => {
          assert.equal(url, "https://catalogo.test/catalogo/ocr-candidatos");
          assert.equal(
            (init.headers as Record<string, string>).Authorization,
            "Bearer clave",
          );
          return new Response(JSON.stringify({ candidatos }), { status: 200 });
        }) as unknown as typeof fetch,
        async () => {
          const resultado = await buscarCandidatosGlobales({
            rubro: "kiosco",
            descripcion: "COCA-COLA 8x2,25",
          });
          assert.deepEqual(resultado, candidatos);
        },
      );
    },
  );
});

test("respuesta 5xx degrada a [] sin lanzar", async () => {
  await withEnv(
    { CATALOGO_API_URL: "https://catalogo.test", CATALOGO_API_KEY: "clave" },
    async () => {
      await withFetch(
        (async () =>
          new Response("boom", { status: 503 })) as unknown as typeof fetch,
        async () => {
          const resultado = await buscarCandidatosGlobales({
            rubro: "kiosco",
            descripcion: "x",
          });
          assert.deepEqual(resultado, []);
        },
      );
    },
  );
});

test("red caída (fetch lanza) degrada a [] sin lanzar", async () => {
  await withEnv(
    { CATALOGO_API_URL: "https://catalogo.test", CATALOGO_API_KEY: "clave" },
    async () => {
      await withFetch(
        (async () => {
          throw new TypeError("fetch failed");
        }) as typeof fetch,
        async () => {
          const resultado = await buscarCandidatosGlobales({
            rubro: "kiosco",
            descripcion: "x",
          });
          assert.deepEqual(resultado, []);
        },
      );
    },
  );
});

test("timeout (AbortError) degrada a [] sin lanzar", async () => {
  await withEnv(
    {
      CATALOGO_API_URL: "https://catalogo.test",
      CATALOGO_API_KEY: "clave",
      CATALOGO_API_TIMEOUT_MS: "1",
    },
    async () => {
      await withFetch(
        (async () => {
          throw new DOMException("The operation was aborted", "AbortError");
        }) as typeof fetch,
        async () => {
          const resultado = await buscarCandidatosGlobales({
            rubro: "kiosco",
            descripcion: "x",
          });
          assert.deepEqual(resultado, []);
        },
      );
    },
  );
});

test("respuesta OK sin campo candidatos degrada a []", async () => {
  await withEnv(
    { CATALOGO_API_URL: "https://catalogo.test", CATALOGO_API_KEY: "clave" },
    async () => {
      await withFetch(
        (async () =>
          new Response(JSON.stringify({}), {
            status: 200,
          })) as unknown as typeof fetch,
        async () => {
          const resultado = await buscarCandidatosGlobales({
            rubro: "kiosco",
            descripcion: "x",
          });
          assert.deepEqual(resultado, []);
        },
      );
    },
  );
});
