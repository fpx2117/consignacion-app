import assert from "node:assert/strict";
import test, { before } from "node:test";

type Handler = typeof import("@/app/api/ventas/route").handlePostVenta;
type Deps = NonNullable<Parameters<Handler>[1]>;
type Auth = Awaited<ReturnType<Deps["requireAuth"]>>;

let handlePostVenta: Handler;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:1/test";
  process.env.JWT_SECRET ??= "t09-characterization-only-secret-1234567890";
  ({ handlePostVenta } = await import("@/app/api/ventas/route"));
});

const okAuth: Auth = {
  ok: true as const,
  user: {
    sub: "7",
    rol: "ADMIN" as const,
    email: "admin@example.com",
    nombre: "Admin",
    sucursalId: 3,
  },
  activeSucursalId: 3,
  allowedSucursalIds: [3],
  isGlobalView: false,
  token: "token",
};

function request(body: string | object) {
  return new Request("http://localhost/api/ventas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeDeps(options: {
  auth?: Auth;
  sub?: string;
  global?: boolean;
  sessionOpen?: boolean;
} = {}) {
  const auth = options.auth ?? {
    ...okAuth,
    user: { ...okAuth.user, sub: options.sub ?? "7" },
  };
  return {
    requireAuth: async () => auth,
    isGlobalSucursalView: () => options.global ?? false,
    obtenerConfiguracionGlobal: async () => ({ usarControlDeCaja: true }),
    resolveTimezoneForAuth: async () => ({ tz: "America/Bogota" }),
    prisma: {
      sesionCaja: {
        findFirst: async () => options.sessionOpen === false ? null : { id: 15 },
      },
      // El dispatch extraído revalida la sesión dentro de la transacción.
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          $queryRaw: async () =>
            options.sessionOpen === false ? [] : [{ id: 15 }],
          cliente: {
            findFirst: async () => ({ id: 22 }),
            create: async () => ({ id: 22 }),
          },
        }),
    },
  } as unknown as Deps;
}

test("caracteriza validaciones previas de POST /api/ventas", async (t) => {
  await t.test("propaga 401 cuando la autenticación falla", async () => {
    const auth = {
      ok: false as const,
      res: Response.json({ error: "No autorizado" }, { status: 401 }),
    } as unknown as Auth;
    const response = await handlePostVenta(request({ items: [] }), makeDeps({ auth }));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "No autorizado" });
  });

  await t.test("rechaza una identidad sin sub numérico", async () => {
    const response = await handlePostVenta(request({ items: [] }), makeDeps({ sub: "invalid" }));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "Identificación de usuario fallida. Reingresa al sistema.",
    });
  });

  await t.test("trata JSON malformado como validación fallida", async () => {
    const response = await handlePostVenta(request("{"), makeDeps());
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Validación fallida",
      details: {
        formErrors: ["Invalid input: expected object, received null"],
        fieldErrors: {},
      },
    });
  });

  await t.test("rechaza un payload vacío", async () => {
    const response = await handlePostVenta(request({ items: [] }), makeDeps());
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Validación fallida",
      details: {
        formErrors: [],
        fieldErrors: { items: ["Too small: expected array to have >=1 items"] },
      },
    });
  });

  await t.test("bloquea la vista global", async () => {
    const response = await handlePostVenta(request({ items: [{ productoId: 1, units: 1 }] }), makeDeps({ global: true }));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "Vista global en modo solo lectura. Selecciona una sucursal para registrar ventas.",
    });
  });

  await t.test("bloquea la venta cuando la caja requerida está cerrada", async () => {
    const response = await handlePostVenta(request({ items: [{ productoId: 1, units: 1 }] }), makeDeps({ sessionOpen: false }));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: "Operación bloqueada: Debes abrir un turno de caja para realizar ventas casuales.",
    });
  });

  // Ambos dispatches comparten la verificación de caja: el switch no habilita
  // una ruta que omita el control.
  for (const useCase of ["legacy", "application"] as const) {
    await t.test(`bloquea la venta sin caja en el dispatch ${useCase}`, async () => {
      process.env.SALES_REGISTER_USE_CASE = useCase;
      try {
        const response = await handlePostVenta(
          request({ items: [{ productoId: 1, units: 1 }] }),
          makeDeps({ sessionOpen: false }),
        );
        assert.equal(response.status, 403);
        assert.deepEqual(await response.json(), {
          error: "Operación bloqueada: Debes abrir un turno de caja para realizar ventas casuales.",
        });
      } finally {
        delete process.env.SALES_REGISTER_USE_CASE;
      }
    });
  }
});
