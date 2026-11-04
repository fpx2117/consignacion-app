import assert from "node:assert/strict";
import test from "node:test";

import {
  CASH_SESSION_REQUIRED_MESSAGE,
  CLIENT_SCOPE_MESSAGE,
  MAX_REGISTER_SALE_ATTEMPTS,
  registerSale,
  SaleDomainError,
  type BranchProduct,
  type PaymentCreation,
  type RegisterSaleCommand,
  type RegisterSaleDependencies,
  type RegisterSaleTransaction,
  type RegisterSaleUnitOfWork,
  type SaleConfiguration,
  type SaleCreation,
  type StockMovementDraft,
} from "@/modules/ventas/application/register-sale";

type FakeSale = {
  id: number;
  total: number;
  clienteId: number;
  cliente: { nombre: string } | null;
};
type FakePayment = { id: number };
type FakeAlert = {
  type: string;
  title: string;
  message: string;
  data: { productId: number };
};

const PRODUCTS: Record<number, BranchProduct> = {
  1: {
    productoId: 1,
    nombre: "Mate",
    precioVenta: 10,
    precioVentaOverride: null,
    descuentoActivo: false,
    tipoDescuento: "porcentaje",
    descuentoPorcentaje: null,
    descuentoMonto: null,
    descuentoDesde: null,
    descuentoHasta: null,
  },
  2: {
    productoId: 2,
    nombre: "Termo",
    precioVenta: 5,
    precioVentaOverride: null,
    descuentoActivo: true,
    tipoDescuento: "porcentaje",
    descuentoPorcentaje: 10,
    descuentoMonto: null,
    descuentoDesde: null,
    descuentoHasta: null,
  },
};

const STOCK: Record<number, { prev: number; post: number }> = {
  1: { prev: 10, post: 8 },
  2: { prev: 20, post: 18 },
};

class RetriableError extends Error {
  constructor() {
    super("serialization conflict");
    this.name = "RetriableError";
  }
}

type HarnessOptions = {
  configuration?: Partial<SaleConfiguration>;
  hasOpenSession?: boolean;
  scopedCustomer?: boolean;
  missingProductId?: number;
  insufficientProductId?: number;
  alert?: FakeAlert | null;
  retriesBeforeSuccess?: number;
  retryAfterWork?: boolean;
  failWith?: Error;
};

function makeHarness(options: HarnessOptions = {}) {
  const journal: string[] = [];
  const saleInputs: SaleCreation[] = [];
  const paymentInputs: PaymentCreation[] = [];
  const movementInputs: StockMovementDraft[] = [];
  const ensureDefaultCalls: number[] = [];
  const sessionSucursales: number[] = [];
  const timezones: string[] = [];
  const dates = [
    new Date("2026-02-01T01:00:00.000Z"),
    new Date("2026-02-01T02:00:00.000Z"),
  ];

  let attempts = 0;
  let remainingRetries = options.retriesBeforeSuccess ?? 0;

  const tx: RegisterSaleTransaction<FakeSale, FakePayment> = {
    lockOpenCashSession: async ({ sucursalId }) => {
      journal.push("session");
      sessionSucursales.push(sucursalId);
      if (options.hasOpenSession === false) return null;
      return { id: 15 };
    },
    ensureDefaultCustomer: async (sucursalId) => {
      journal.push("default-customer");
      ensureDefaultCalls.push(sucursalId);
      return 33;
    },
    lockStockAuthority: async () => {
      journal.push("lock");
      return { mode: "APP_DUAL_WRITE", projection: false };
    },
    findScopedCustomer: async () => {
      journal.push("customer");
      return options.scopedCustomer === false ? null : { id: 22 };
    },
    findBranchProduct: async ({ productoId }) => {
      journal.push(`product:${productoId}`);
      if (options.missingProductId === productoId) return null;
      return PRODUCTS[productoId] ?? null;
    },
    decrementBranchStock: async ({ productoId }) => {
      journal.push(`decrement:${productoId}`);
      if (options.insufficientProductId === productoId) return null;
      const stock = STOCK[productoId];
      return {
        prev: stock.prev,
        post: stock.post,
        product: {
          id: productoId,
          nombre: PRODUCTS[productoId].nombre,
          stockDisponibleUnits: stock.post,
          stockMinUnits: 0,
        },
      };
    },
    recordStockMovement: async (input) => {
      journal.push(`movement:${input.productoId}`);
      movementInputs.push(input);
    },
    createSale: async (input) => {
      journal.push("sale");
      saleInputs.push(input);
      return {
        id: 77,
        total: input.total,
        clienteId: input.clienteId,
        cliente: { nombre: "Consumidor Final" },
      };
    },
    createPayment: async (input) => {
      journal.push("payment");
      paymentInputs.push(input);
      return { id: 88 };
    },
  };

  const unitOfWork: RegisterSaleUnitOfWork<FakeSale, FakePayment> = {
    runSerializable: async (work) => {
      attempts += 1;
      if (remainingRetries > 0) {
        remainingRetries -= 1;
        if (options.retryAfterWork) {
          await work(tx).catch(() => undefined);
        }
        throw new RetriableError();
      }
      if (options.failWith) throw options.failWith;
      return work(tx);
    },
    isRetriable: (error) => error instanceof RetriableError,
  };

  const deps: RegisterSaleDependencies<FakeSale, FakePayment, FakeAlert> = {
    unitOfWork,
    loadConfiguration: async () => ({
      usarControlDeCaja: true,
      notificarVentas: true,
      porcentajeInteresTarjeta: 0,
      minStockGlobal: 5,
      notificarStockBajo: true,
      ...options.configuration,
    }),
    resolveTimezone: async () => ({ tz: "America/Bogota" }),
    now: (tz) => {
      timezones.push(tz);
      return dates.shift() ?? new Date(0);
    },
    resolveCatalogDiscount: (product) => {
      journal.push(`discount:${product.precioVenta}`);
      return product.descuentoActivo ? { montoDescuento: 0.5 } : null;
    },
    evaluateStockAlert: (product) => {
      journal.push(`alert:${product.id}`);
      return options.alert ?? null;
    },
  };

  return {
    deps,
    journal,
    saleInputs,
    paymentInputs,
    movementInputs,
    ensureDefaultCalls,
    sessionSucursales,
    timezones,
    attempts: () => attempts,
  };
}

function baseCommand(
  overrides: Partial<RegisterSaleCommand> = {},
): RegisterSaleCommand {
  return {
    usuarioId: 7,
    sucursalId: 3,
    clienteId: 22,
    paymentMethod: "TARJETA",
    globalDiscount: 4,
    items: [
      { productoId: 1, units: 2 },
      { productoId: 2, units: 2 },
    ],
    ...overrides,
  };
}

test("registra la venta con los totales, el orden y los efectos del contrato", async () => {
  const harness = makeHarness({ configuration: { porcentajeInteresTarjeta: 8 } });

  const result = await registerSale(
    baseCommand(),
    harness.deps,
  );

  assert.deepEqual(harness.journal, [
    "session",
    "lock",
    "customer",
    "product:1",
    "decrement:1",
    "movement:1",
    "alert:1",
    "discount:10",
    "product:2",
    "decrement:2",
    "movement:2",
    "alert:2",
    "discount:5",
    "sale",
    "payment",
  ]);
  assert.equal(harness.attempts(), 1);

  const [sale] = harness.saleInputs;
  assert.equal(sale.tipo, "CASUAL");
  assert.equal(sale.clienteId, 22);
  assert.equal(sale.sucursalId, 3);
  assert.equal(sale.metodoPago, "TARJETA");
  assert.equal(sale.sesionCajaId, 15);
  assert.equal(sale.total, 27);
  assert.equal(sale.descuentoGlobal, 4);
  assert.deepEqual(sale.detalles, [
    {
      productoId: 1,
      units: 2,
      precioUnitario: 10,
      descuento: 0,
      subtotal: 20,
    },
    {
      productoId: 2,
      units: 2,
      precioUnitario: 5,
      descuento: 1,
      subtotal: 9,
    },
  ]);

  const [payment] = harness.paymentInputs;
  assert.equal(payment.monto, 27);
  assert.equal(payment.metodo, "TARJETA");
  assert.equal(payment.sesionCajaId, 15);

  assert.deepEqual(harness.movementInputs, [
    {
      productoId: 1,
      sucursalId: 3,
      units: 2,
      stockPrevio: 10,
      stockPosterior: 8,
      observaciones: "Venta POS - Sesión #15",
    },
    {
      productoId: 2,
      sucursalId: 3,
      units: 2,
      stockPrevio: 20,
      stockPosterior: 18,
      observaciones: "Venta POS - Sesión #15",
    },
  ]);

  // Dos lecturas del reloj, siempre con la timezone resuelta.
  assert.deepEqual(harness.timezones, ["America/Bogota", "America/Bogota"]);
  // La sesión se busca con la sucursal de la venta, no con una caja cualquiera.
  assert.deepEqual(harness.sessionSucursales, [3]);
  assert.equal(sale.fecha.toISOString(), "2026-02-01T01:00:00.000Z");
  assert.equal(payment.fecha.toISOString(), "2026-02-01T02:00:00.000Z");

  assert.equal(result.sale.id, 77);
  assert.deepEqual(result.saleNotification, {
    ventaId: 77,
    total: 27,
    clienteId: 22,
    clienteNombre: "Consumidor Final",
  });
  assert.deepEqual(result.stockAlerts, []);
});

test("el descuento manual manda sobre el de catálogo", async () => {
  const harness = makeHarness();

  await registerSale(
    baseCommand({
      paymentMethod: "EFECTIVO",
      globalDiscount: 0,
      items: [{ productoId: 2, units: 2, descuento: 0.25 }],
    }),
    harness.deps,
  );

  const [sale] = harness.saleInputs;
  assert.deepEqual(sale.detalles, [
    {
      productoId: 2,
      units: 2,
      precioUnitario: 5,
      descuento: 0.25,
      subtotal: 9.75,
    },
  ]);
  assert.equal(sale.total, 9.75);
});

test("sin caja abierta rechaza dentro del intento antes de cualquier efecto", async () => {
  const harness = makeHarness({ hasOpenSession: false });

  await assert.rejects(
    registerSale(baseCommand(), harness.deps),
    (error: unknown) => {
      assert.ok(error instanceof SaleDomainError);
      assert.equal(error.code, "CASH_SESSION_REQUIRED");
      assert.equal(error.message, CASH_SESSION_REQUIRED_MESSAGE);
      return true;
    },
  );

  // La transacción se abrió y la sesión se revalidó dentro de ella; no hubo
  // efectos durables.
  assert.equal(harness.attempts(), 1);
  assert.deepEqual(harness.journal, ["session"]);
});

test("con el control de caja desactivado opera sin sesión", async () => {
  const harness = makeHarness({
    hasOpenSession: false,
    configuration: { usarControlDeCaja: false },
  });

  await registerSale(baseCommand(), harness.deps);

  assert.equal(harness.saleInputs[0].sesionCajaId, null);
  assert.equal(
    harness.movementInputs[0].observaciones,
    "Venta POS - Rápida (Sin Caja)",
  );
});

test("resuelve el cliente por defecto sólo cuando falta", async () => {
  const harness = makeHarness();

  await registerSale(baseCommand({ clienteId: null }), harness.deps);
  assert.deepEqual(harness.ensureDefaultCalls, [3]);
  assert.equal(harness.saleInputs[0].clienteId, 33);

  const provided = makeHarness();
  await registerSale(baseCommand({ clienteId: 22 }), provided.deps);
  assert.deepEqual(provided.ensureDefaultCalls, []);
  assert.equal(provided.saleInputs[0].clienteId, 22);
});

test("un cliente de otra sucursal comparte el rechazo de estado", async () => {
  const harness = makeHarness({ scopedCustomer: false });

  await assert.rejects(
    registerSale(baseCommand(), harness.deps),
    (error: unknown) => {
      assert.ok(error instanceof SaleDomainError);
      assert.equal(error.code, "CLIENT_OUT_OF_SCOPE");
      assert.equal(error.message, CLIENT_SCOPE_MESSAGE);
      return true;
    },
  );
  assert.deepEqual(harness.saleInputs, []);
  assert.deepEqual(harness.paymentInputs, []);
  assert.deepEqual(harness.movementInputs, []);
});

test("producto sin asignación a la sucursal no deja efectos", async () => {
  const harness = makeHarness({ missingProductId: 1 });

  await assert.rejects(
    registerSale(baseCommand(), harness.deps),
    (error: unknown) => {
      assert.ok(error instanceof SaleDomainError);
      assert.equal(error.code, "PRODUCT_NOT_IN_BRANCH");
      assert.equal(
        error.message,
        "El producto #1 no está asignado a esta sucursal.",
      );
      return true;
    },
  );
  assert.deepEqual(harness.saleInputs, []);
  assert.deepEqual(harness.movementInputs, []);
});

test("stock insuficiente no deja efectos", async () => {
  const harness = makeHarness({ insufficientProductId: 2 });

  await assert.rejects(
    registerSale(baseCommand(), harness.deps),
    (error: unknown) => {
      assert.ok(error instanceof SaleDomainError);
      assert.equal(error.code, "INSUFFICIENT_STOCK");
      assert.equal(error.message, 'Stock insuficiente para "Termo".');
      return true;
    },
  );
  assert.deepEqual(harness.saleInputs, []);
  // El primer ítem sí se procesó dentro de la transacción; el adaptador es
  // quien revierte, igual que el handler legacy. La aplicación no continúa.
  assert.equal(harness.movementInputs.length, 1);
});

test("reintenta conflictos serializables y registra una sola venta", async () => {
  const harness = makeHarness({ retriesBeforeSuccess: 2 });

  const result = await registerSale(baseCommand(), harness.deps);

  assert.equal(harness.attempts(), 3);
  assert.equal(harness.saleInputs.length, 1);
  assert.equal(harness.paymentInputs.length, 1);
  assert.equal(result.sale.id, 77);
});

test("revalida la sesión y el cliente por defecto en cada intento", async () => {
  const harness = makeHarness({
    retriesBeforeSuccess: 1,
    retryAfterWork: true,
  });

  await registerSale(baseCommand({ clienteId: null }), harness.deps);

  // Dos intentos: el segundo vuelve a bloquear la sesión y a resolver el
  // cliente, en vez de arrastrar los valores del intento fallido. El fake no
  // revierte, así que las escrituras del intento descartado quedan en el
  // journal; lo que se afirma es la re-ejecución de las dos revalidaciones.
  assert.equal(harness.attempts(), 2);
  assert.equal(
    harness.journal.filter((entry) => entry === "session").length,
    2,
  );
  assert.deepEqual(harness.ensureDefaultCalls, [3, 3]);
});

test("agota los intentos y propaga el último conflicto", async () => {
  const harness = makeHarness({ retriesBeforeSuccess: 10 });

  await assert.rejects(
    registerSale(baseCommand(), harness.deps),
    RetriableError,
  );
  assert.equal(harness.attempts(), MAX_REGISTER_SALE_ATTEMPTS);
  assert.deepEqual(harness.saleInputs, []);
});

test("un error no reintentable se propaga sin fallback", async () => {
  const failure = new Error("internal detail");
  const harness = makeHarness({ failWith: failure });

  await assert.rejects(registerSale(baseCommand(), harness.deps), (error) => {
    assert.equal(error, failure);
    return true;
  });
  assert.equal(harness.attempts(), 1);
  assert.deepEqual(harness.saleInputs, []);
});

test("no emite notificación cuando la configuración la desactiva", async () => {
  const harness = makeHarness({
    configuration: { notificarVentas: false },
  });

  const result = await registerSale(baseCommand(), harness.deps);
  assert.equal(result.saleNotification, null);
});

test("acumula las alertas de stock evaluadas dentro de la transacción", async () => {
  const alert: FakeAlert = {
    type: "LOW_STOCK",
    title: "Stock Bajo",
    message: "Quedan pocas unidades",
    data: { productId: 1 },
  };
  const harness = makeHarness({ alert });

  const result = await registerSale(baseCommand(), harness.deps);

  assert.deepEqual(result.stockAlerts, [alert, alert]);
});
