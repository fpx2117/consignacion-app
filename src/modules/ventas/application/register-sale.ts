// src/modules/ventas/application/register-sale.ts
// Piloto `RegistrarVenta` (ADR 001, ADR 006).
//
// Orquesta el registro de una venta POS sin conocer Prisma, Next.js, Socket.IO
// ni el reloj global: todo efecto de infraestructura entra por los puertos
// definidos acá. La ruta HTTP queda limitada a autenticar, validar, construir el
// comando, ejecutar el caso de uso y traducir errores.
//
// Contrato de compatibilidad: reproduce el mismo cálculo, el mismo orden de
// efectos durables y la misma respuesta observable que el adaptador legacy. La
// equivalencia se demuestra ejecutando la caracterización HTTP contra ambos
// dispatches, nunca ejecutando los dos para la misma venta.

import {
  calculateLineTotal,
  calculateSaleTotals,
} from "@/modules/ventas/sale-totals";

export const MAX_REGISTER_SALE_ATTEMPTS = 3;

export const CASH_SESSION_REQUIRED_MESSAGE =
  "Operación bloqueada: Debes abrir un turno de caja para realizar ventas casuales.";
export const CLIENT_SCOPE_MESSAGE =
  "El cliente seleccionado no pertenece a la sucursal activa.";

/** Métodos de pago admitidos por el POS; mismos valores que `MetodoPago`. */
export type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "OTRO";

export type SaleItemInput = {
  productoId: number;
  units: number;
  /** Descuento absoluto cargado a mano para la línea completa. */
  descuento?: number;
};

export type RegisterSaleCommand = {
  usuarioId: number;
  sucursalId: number;
  /** `null` selecciona el cliente "Consumidor Final" de la sucursal. */
  clienteId: number | null;
  paymentMethod: PaymentMethod;
  globalDiscount?: number;
  items: SaleItemInput[];
};

/** Subconjunto de `Configuracion` que consume el caso de uso. */
export type SaleConfiguration = {
  usarControlDeCaja: boolean | null;
  notificarVentas: boolean | null;
  porcentajeInteresTarjeta: number | null;
  minStockGlobal: number;
  notificarStockBajo?: boolean;
};

export type SaleDomainErrorCode =
  | "CASH_SESSION_REQUIRED"
  | "CLIENT_OUT_OF_SCOPE"
  | "PRODUCT_NOT_IN_BRANCH"
  | "INSUFFICIENT_STOCK";

export class SaleDomainError extends Error {
  constructor(
    readonly code: SaleDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SaleDomainError";
  }
}

/** Campos decimales de Prisma que la respuesta serializa con `toString`. */
export type DecimalLike = { toString(): string };

/** Mínimo que el caso de uso necesita de la venta persistida. */
export type SaleRecord = {
  id: number;
  total: DecimalLike;
  clienteId: number;
  cliente: { nombre: string } | null;
};

export type PaymentRecord = { id: number };

export type StockAlertProduct = {
  id: number;
  nombre: string;
  stockDisponibleUnits: number;
  stockMinUnits: number;
};

/**
 * Forma estructural de la capacidad de stock. No importa el módulo de
 * inventario: el handle es opaco para la aplicación y lo interpreta el adaptador
 * que también abrió la transacción.
 */
export type StockAuthorityHandle = {
  mode: "APP_DUAL_WRITE" | "DB_PROJECTION";
  projection: boolean;
};

export type BranchProduct = {
  productoId: number;
  nombre: string;
  precioVenta: number;
  precioVentaOverride: number | null;
  descuentoActivo: boolean;
  tipoDescuento: string;
  descuentoPorcentaje: number | null;
  descuentoMonto: number | null;
  descuentoDesde: Date | null;
  descuentoHasta: Date | null;
};

export type SaleDetailDraft = {
  productoId: number;
  units: number;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
};

export type SaleCreation = {
  tipo: "CASUAL";
  clienteId: number;
  sucursalId: number;
  metodoPago: PaymentMethod;
  sesionCajaId: number | null;
  fecha: Date;
  total: number;
  descuentoGlobal: number;
  detalles: SaleDetailDraft[];
};

export type PaymentCreation = {
  clienteId: number;
  sucursalId: number;
  fecha: Date;
  monto: number;
  metodo: PaymentMethod;
  sesionCajaId: number | null;
};

export type StockMovementDraft = {
  productoId: number;
  sucursalId: number;
  units: number;
  stockPrevio: number;
  stockPosterior: number;
  observaciones: string;
};

export type SaleNotificationIntent = {
  ventaId: number;
  total: DecimalLike;
  clienteId: number;
  clienteNombre: string;
};

/**
 * Capacidades específicas que el caso de uso necesita dentro de la transacción.
 * Es una unidad de trabajo, no un repositorio genérico: cada método corresponde
 * a un efecto que la venta realmente ejecuta.
 */
export type RegisterSaleTransaction<
  TSale extends SaleRecord,
  TPayment extends PaymentRecord,
> = {
  findScopedCustomer(input: {
    clienteId: number;
    sucursalId: number;
  }): Promise<{ id: number } | null>;
  lockStockAuthority(): Promise<StockAuthorityHandle>;
  findBranchProduct(input: {
    productoId: number;
    sucursalId: number;
  }): Promise<BranchProduct | null>;
  decrementBranchStock(input: {
    productoId: number;
    sucursalId: number;
    units: number;
    authority: StockAuthorityHandle;
  }): Promise<{
    prev: number;
    post: number;
    product: StockAlertProduct;
  } | null>;
  recordStockMovement(input: StockMovementDraft): Promise<void>;
  createSale(input: SaleCreation): Promise<TSale>;
  createPayment(input: PaymentCreation): Promise<TPayment>;
};

/**
 * Adaptador de persistencia. Abre la transacción `Serializable` y expone las
 * capacidades de la venta; el caso de uso conserva los reintentos.
 */
export type RegisterSaleUnitOfWork<
  TSale extends SaleRecord,
  TPayment extends PaymentRecord,
> = {
  findOpenCashSession(usuarioId: number): Promise<{ id: number } | null>;
  ensureDefaultCustomer(sucursalId: number): Promise<number>;
  runSerializable<T>(
    work: (tx: RegisterSaleTransaction<TSale, TPayment>) => Promise<T>,
  ): Promise<T>;
  isRetriable(error: unknown): boolean;
};

export type CatalogDiscount = { montoDescuento: number } | null;

export type RegisterSaleDependencies<
  TSale extends SaleRecord,
  TPayment extends PaymentRecord,
  TAlert,
> = {
  unitOfWork: RegisterSaleUnitOfWork<TSale, TPayment>;
  loadConfiguration(sucursalId: number): Promise<SaleConfiguration>;
  resolveTimezone(): Promise<{ tz: string }>;
  now(tz: string): Date;
  resolveCatalogDiscount(product: {
    descuentoActivo: boolean;
    tipoDescuento: string;
    descuentoPorcentaje: number | null;
    descuentoMonto: number | null;
    descuentoDesde: Date | null;
    descuentoHasta: Date | null;
    precioVenta: number;
  }): CatalogDiscount;
  evaluateStockAlert(
    product: StockAlertProduct,
    configuration: SaleConfiguration,
  ): TAlert | null;
};

export type RegisterSaleResult<
  TSale extends SaleRecord,
  TPayment extends PaymentRecord,
  TAlert,
> = {
  sale: TSale;
  payment: TPayment;
  /** Alertas evaluadas dentro de la transacción, para emitir después del commit. */
  stockAlerts: TAlert[];
  /** Intento de notificación de venta, o `null` si la configuración la desactiva. */
  saleNotification: SaleNotificationIntent | null;
};

type ExecuteSaleInput<
  TSale extends SaleRecord,
  TPayment extends PaymentRecord,
  TAlert,
> = {
  command: RegisterSaleCommand;
  clienteId: number;
  openSession: { id: number } | null;
  configuration: SaleConfiguration;
  timezone: { tz: string };
  tx: RegisterSaleTransaction<TSale, TPayment>;
  deps: RegisterSaleDependencies<TSale, TPayment, TAlert>;
};

async function executeSale<
  TSale extends SaleRecord,
  TPayment extends PaymentRecord,
  TAlert,
>(input: ExecuteSaleInput<TSale, TPayment, TAlert>) {
  const { command, clienteId, openSession, configuration, timezone, tx, deps } =
    input;
  const sucursalId = command.sucursalId;

  const authority = await tx.lockStockAuthority();

  // La sucursal activa es la única fuente de alcance del cliente; un cliente
  // ausente o de otra sucursal comparte el mismo rechazo.
  const scopedClient = await tx.findScopedCustomer({ clienteId, sucursalId });
  if (!scopedClient) {
    throw new SaleDomainError("CLIENT_OUT_OF_SCOPE", CLIENT_SCOPE_MESSAGE);
  }

  const details: SaleDetailDraft[] = [];
  const stockAlerts: TAlert[] = [];

  for (const item of command.items) {
    const branchProduct = await tx.findBranchProduct({
      productoId: item.productoId,
      sucursalId,
    });
    if (!branchProduct) {
      throw new SaleDomainError(
        "PRODUCT_NOT_IN_BRANCH",
        `El producto #${item.productoId} no está asignado a esta sucursal.`,
      );
    }

    const moved = await tx.decrementBranchStock({
      productoId: item.productoId,
      sucursalId,
      units: item.units,
      authority,
    });
    if (!moved) {
      throw new SaleDomainError(
        "INSUFFICIENT_STOCK",
        `Stock insuficiente para "${branchProduct.nombre}".`,
      );
    }

    await tx.recordStockMovement({
      productoId: item.productoId,
      sucursalId,
      units: item.units,
      stockPrevio: moved.prev,
      stockPosterior: moved.post,
      observaciones: openSession
        ? `Venta POS - Sesión #${openSession.id}`
        : `Venta POS - Rápida (Sin Caja)`,
    });

    const alert = deps.evaluateStockAlert(moved.product, configuration);
    if (alert !== null) stockAlerts.push(alert);

    const unitPrice =
      branchProduct.precioVentaOverride ?? branchProduct.precioVenta;
    // El descuento de catálogo se resuelve siempre; `applyDiscount` ignora el de
    // catálogo cuando la línea trae uno manual.
    const catalogDiscount = deps.resolveCatalogDiscount({
      descuentoActivo: branchProduct.descuentoActivo,
      tipoDescuento: branchProduct.tipoDescuento,
      descuentoPorcentaje: branchProduct.descuentoPorcentaje,
      descuentoMonto: branchProduct.descuentoMonto,
      descuentoDesde: branchProduct.descuentoDesde,
      descuentoHasta: branchProduct.descuentoHasta,
      precioVenta: unitPrice,
    });

    const line = calculateLineTotal({
      unitPrice,
      units: item.units,
      manualDiscount: item.descuento,
      catalogDiscountPerUnit: catalogDiscount?.montoDescuento ?? null,
    });

    details.push({
      productoId: item.productoId,
      units: item.units,
      precioUnitario: unitPrice,
      descuento: line.discount,
      subtotal: line.subtotal,
    });
  }

  const totals = calculateSaleTotals({
    lineSubtotals: details.map((detail) => detail.subtotal),
    globalDiscount: command.globalDiscount,
    appliesCardSurcharge: command.paymentMethod === "TARJETA",
    cardSurchargePercentage: configuration.porcentajeInteresTarjeta,
  });

  // Dos lecturas del reloj, igual que el adaptador legacy: venta y pago pueden
  // diferir por milisegundos y la caracterización lo fija.
  const sale = await tx.createSale({
    tipo: "CASUAL",
    clienteId,
    sucursalId,
    metodoPago: command.paymentMethod,
    sesionCajaId: openSession?.id ?? null,
    fecha: deps.now(timezone.tz),
    total: totals.total,
    descuentoGlobal: totals.globalDiscount,
    detalles: details,
  });

  const payment = await tx.createPayment({
    clienteId,
    sucursalId,
    fecha: deps.now(timezone.tz),
    monto: totals.total,
    metodo: command.paymentMethod,
    sesionCajaId: openSession?.id ?? null,
  });

  return {
    sale,
    payment,
    stockAlerts,
    saleNotification:
      configuration.notificarVentas === false
        ? null
        : {
            ventaId: sale.id,
            total: sale.total,
            clienteId: sale.clienteId,
            clienteNombre: sale.cliente?.nombre || "Consumidor Final",
          },
  } satisfies RegisterSaleResult<TSale, TPayment, TAlert>;
}

/**
 * Registra una venta POS. Ejecuta exactamente un intento por vez y reintenta
 * sólo conflictos serializables o de unicidad, hasta `MAX_REGISTER_SALE_ATTEMPTS`.
 */
export async function registerSale<
  TSale extends SaleRecord,
  TPayment extends PaymentRecord,
  TAlert,
>(
  command: RegisterSaleCommand,
  deps: RegisterSaleDependencies<TSale, TPayment, TAlert>,
): Promise<RegisterSaleResult<TSale, TPayment, TAlert>> {
  const [configuration, timezone] = await Promise.all([
    deps.loadConfiguration(command.sucursalId),
    deps.resolveTimezone(),
  ]);

  const usesCashControl = configuration.usarControlDeCaja ?? true;
  const openSession = await deps.unitOfWork.findOpenCashSession(
    command.usuarioId,
  );
  if (usesCashControl && !openSession) {
    throw new SaleDomainError(
      "CASH_SESSION_REQUIRED",
      CASH_SESSION_REQUIRED_MESSAGE,
    );
  }

  // Etapa compatible (ADR 006): el cliente por defecto se resuelve antes de la
  // transacción, como en el adaptador legacy. Moverlo dentro de cada intento es
  // el endurecimiento posterior de la tarea T20.
  const clienteId =
    command.clienteId ??
    (await deps.unitOfWork.ensureDefaultCustomer(command.sucursalId));

  for (let attempt = 1; attempt <= MAX_REGISTER_SALE_ATTEMPTS; attempt++) {
    try {
      return await deps.unitOfWork.runSerializable((tx) =>
        executeSale({
          command,
          clienteId,
          openSession,
          configuration,
          timezone,
          tx,
          deps,
        }),
      );
    } catch (error) {
      if (
        !deps.unitOfWork.isRetriable(error) ||
        attempt === MAX_REGISTER_SALE_ATTEMPTS
      ) {
        throw error;
      }
    }
  }

  // Alcanzable sólo si el adaptador deja de reportar conflictos como
  // reintentables; el mensaje mantiene el contrato 500 del handler legacy.
  throw new Error("No se pudo registrar la venta por concurrencia");
}
