// src/modules/ventas/infrastructure/prisma-register-sale.ts
// Adaptador Prisma de la unidad de trabajo de `RegistrarVenta`.
//
// Es el único punto que traduce entre las capacidades del caso de uso y las
// operaciones reales: transacción `Serializable`, autoridad de stock del ADR 002
// y autoridad de numeración del ADR 007. Nada de esto cruza al dominio.

import { MotivoMovimientoStock, Prisma, TipoMovimientoStock, TipoVenta } from "@prisma/client";

import {
  decrementBranchStock,
  lockStockAuthority,
} from "@/modules/inventory/stock-authority";
import type {
  BranchProduct,
  PaymentCreation,
  RegisterSaleTransaction,
  RegisterSaleUnitOfWork,
  SaleCreation,
  StockMovementDraft,
} from "@/modules/ventas/application/register-sale";
import { createVentaWithAuthority } from "@/modules/ventas/venta-numbering-authority";

type PrismaClientLike = typeof import("@/lib/prisma").prisma;

export type VentaCreada = Prisma.VentaGetPayload<{
  include: { detalles: true; cliente: true };
}>;
export type PagoCreado = Prisma.PagoGetPayload<object>;

function toNumber(value: { toString(): string } | null): number | null {
  return value === null ? null : Number(value);
}

function createTransaction(
  tx: Prisma.TransactionClient,
): RegisterSaleTransaction<VentaCreada, PagoCreado> {
  return {
    findScopedCustomer: ({ clienteId, sucursalId }) =>
      tx.cliente.findFirst({
        where: { id: clienteId, sucursalId },
        select: { id: true },
      }),

    lockStockAuthority: () => lockStockAuthority(tx),

    // Bloquea la sesión abierta del usuario. `FOR SHARE` impide que el cierre la
    // marque CERRADA mientras la venta se registra, y si el cierre ya commiteó la
    // fila deja de cumplir `estado = 'ABIERTA'` y no se devuelve nada.
    lockOpenCashSession: async (usuarioId) => {
      const rows = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM public."SesionCaja"
        WHERE "usuarioId" = ${usuarioId} AND "estado" = 'ABIERTA'
        LIMIT 1
        FOR SHARE
      `;
      return rows[0] ? { id: rows[0].id } : null;
    },

    ensureDefaultCustomer: async (sucursalId) => {
      const existing = await tx.cliente.findFirst({
        where: { nombre: "Consumidor Final", sucursalId },
        select: { id: true },
      });
      if (existing) return existing.id;

      const created = await tx.cliente.create({
        data: {
          nombre: "Consumidor Final",
          direccion: "Venta Mostrador",
          activo: true,
          sucursalId,
        },
        select: { id: true },
      });
      return created.id;
    },

    findBranchProduct: async ({
      productoId,
      sucursalId,
    }): Promise<BranchProduct | null> => {
      const row = await tx.stockSucursal.findUnique({
        where: { productoId_sucursalId: { productoId, sucursalId } },
        include: { producto: true },
      });
      if (!row) return null;

      const producto = row.producto;
      return {
        productoId,
        nombre: producto.nombre,
        precioVenta: Number(producto.precioVenta),
        precioVentaOverride: toNumber(row.precioVentaOverride),
        descuentoActivo: producto.descuentoActivo,
        tipoDescuento: producto.tipoDescuento,
        // El legacy convierte con truthiness: un descuento en 0 se trata como
        // ausente. Se conserva esa lectura exacta.
        descuentoPorcentaje: producto.descuentoPorcentaje
          ? Number(producto.descuentoPorcentaje)
          : null,
        descuentoMonto: producto.descuentoMonto
          ? Number(producto.descuentoMonto)
          : null,
        descuentoDesde: producto.descuentoDesde,
        descuentoHasta: producto.descuentoHasta,
      };
    },

    // `decrementBranchStock` ya aplica el delta global cuando la autoridad es
    // APP_DUAL_WRITE y sólo escribe StockSucursal bajo DB_PROJECTION. El producto
    // se relee para que la alerta de stock use el valor realmente persistido.
    decrementBranchStock: async ({ productoId, sucursalId, units, authority }) => {
      const moved = await decrementBranchStock(tx, authority, {
        productoId,
        sucursalId,
        units,
      });
      if (!moved) return null;

      const product = await tx.producto.findUniqueOrThrow({
        where: { id: productoId },
        select: {
          id: true,
          nombre: true,
          stockDisponibleUnits: true,
          stockMinUnits: true,
        },
      });

      return { prev: moved.prev, post: moved.post, product };
    },

    recordStockMovement: async (input: StockMovementDraft) => {
      await tx.movimientoStock.create({
        data: {
          productoId: input.productoId,
          sucursalId: input.sucursalId,
          tipo: TipoMovimientoStock.SALIDA,
          motivo: MotivoMovimientoStock.VENTA,
          cantidad: input.units,
          stockPrevio: input.stockPrevio,
          stockPosterior: input.stockPosterior,
          observaciones: input.observaciones,
        },
      });
    },

    createSale: async (input: SaleCreation) => {
      // Lock heredado de la serie por sucursal. Tanto el adaptador legacy como
      // el webhook de Mercado Pago lo toman antes de crear su venta; se conserva
      // para no alterar el orden de adquisición entre writers. La numeración
      // real la asigna la autoridad PostgreSQL dentro de createVentaWithAuthority.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(1000000 + input.sucursalId)})`;

      return createVentaWithAuthority(tx, {
        data: {
          tipo: TipoVenta.CASUAL,
          clienteId: input.clienteId,
          sucursalId: input.sucursalId,
          metodoPago: input.metodoPago,
          sesionCajaId: input.sesionCajaId,
          fecha: input.fecha,
          total: input.total,
          descuentoGlobal: input.descuentoGlobal,
          detalles: { create: input.detalles },
        },
        include: { detalles: true, cliente: true },
      });
    },

    createPayment: (input: PaymentCreation) =>
      tx.pago.create({
        data: {
          clienteId: input.clienteId,
          sucursalId: input.sucursalId,
          tipo: "VENTA",
          sesionCajaId: input.sesionCajaId,
          fecha: input.fecha,
          monto: input.monto,
          metodo: input.metodo,
        },
      }),
  };
}

export function createPrismaRegisterSaleUnitOfWork(
  prisma: PrismaClientLike,
): RegisterSaleUnitOfWork<VentaCreada, PagoCreado> {
  return {
    runSerializable: <T>(
      work: (tx: RegisterSaleTransaction<VentaCreada, PagoCreado>) => Promise<T>,
    ) =>
      prisma.$transaction<T>((tx) => work(createTransaction(tx)), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),

    isRetriable: (error) =>
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034"),
  };
}
