import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { createLiquidacionBodySchema } from "@/lib/validators/liquidacion";
import { TipoMovimientoStock, MotivoMovimientoStock } from "@prisma/client";

// ✅ Imports Centralizados de Config y Notificaciones
import { obtenerConfiguracionGlobal } from "@/lib/config";
import {
  evaluateStockAlert,
  processNotificationQueue,
} from "@/lib/notificaciones/stock-alerts";
import {
  buildSucursalWhere,
  isGlobalSucursalView,
} from "@/lib/security/sucursalScope";
import {
  assertVentaNumberingAuthority,
  createVentaWithAuthority,
} from "@/modules/ventas/venta-numbering-authority";
import {
  applyProductoGlobalDelta,
  lockStockAuthority,
  StockAuthorityError,
} from "@/modules/inventory/stock-authority";
import { calculatePendingUnits, validateSettlement } from "@/modules/consignaciones/units";
import { claimSettlementUnits } from "@/modules/consignaciones/settlement-claim";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type StockNotification = NonNullable<ReturnType<typeof evaluateStockAlert>>;

export type LiquidacionPutDeps = {
  prisma: typeof prisma;
  requireAuth: typeof requireAuth;
  isGlobalSucursalView: typeof isGlobalSucursalView;
  obtenerConfiguracionGlobal: typeof obtenerConfiguracionGlobal;
  evaluateStockAlert: typeof evaluateStockAlert;
  processNotificationQueue: typeof processNotificationQueue;
};

const defaultPutDeps: LiquidacionPutDeps = {
  prisma,
  requireAuth,
  isGlobalSucursalView,
  obtenerConfiguracionGlobal,
  evaluateStockAlert,
  processNotificationQueue,
};

/**
 * GET /api/liquidaciones/[id]
 */
export async function GET(_: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  const sucursalWhere = buildSucursalWhere(auth);

  const { id: rawId } = await params;
  const liquidacionId = Number(rawId);

  if (!Number.isFinite(liquidacionId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const liq = await prisma.liquidacion.findFirst({
    where: {
      id: liquidacionId,
      consignacion: sucursalWhere,
    },
    include: {
      items: { include: { detalle: { include: { producto: true } } } },
      venta: { include: { detalles: true } },
      consignacion: {
        include: {
          cliente: true,
          detalles: { include: { producto: true } },
        },
      },
    },
  });

  if (!liq)
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  return NextResponse.json({ data: liq });
}

/**
 * PUT /api/liquidaciones/[id]
 * Corregir una liquidación existente (reversa + aplica nuevo)
 */
export async function PUT(req: Request, context: RouteParams) {
  return handlePutLiquidacion(req, context);
}

export async function handlePutLiquidacion(
  req: Request,
  { params }: RouteParams,
  deps: LiquidacionPutDeps = defaultPutDeps,
) {
  const auth = await deps.requireAuth();
  if (!auth.ok) return auth.res;
  if (deps.isGlobalSucursalView(auth)) {
    return NextResponse.json(
      {
        error:
          "Vista global en modo solo lectura. Selecciona una sucursal para editar liquidaciones.",
      },
      { status: 409 },
    );
  }

  const { id: rawId } = await params;
  const liquidacionId = Number(rawId);

  if (!Number.isFinite(liquidacionId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createLiquidacionBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // ✅ 1. Preparar Configuración y Cola de Notificaciones
  const configGlobal = await deps.obtenerConfiguracionGlobal(
    auth.activeSucursalId,
  );
  const notificationsQueue: StockNotification[] = [];

  try {
    const result = await deps.prisma.$transaction(async (tx) => {
      const stockAuthority = await lockStockAuthority(tx);

      // Serializa correcciones de la misma liquidación: dos correcciones
      // concurrentes revertirían dos veces los mismos acumulados.
      await tx.$queryRaw`
        SELECT "id" FROM public."Liquidacion" WHERE "id" = ${liquidacionId} FOR UPDATE
      `;

      // 0) Buscar liquidación existente
      const liqExistente = await tx.liquidacion.findFirst({
        where: {
          id: liquidacionId,
          consignacion: { sucursalId: auth.activeSucursalId },
        },
        include: {
          items: true,
          venta: true,
          consignacion: {
            include: {
              cliente: true,
              detalles: { include: { producto: true } },
            },
          },
        },
      });

      if (!liqExistente) throw new Error("LIQUIDACION_NO_ENCONTRADA");
      const consignacionId = liqExistente.consignacionId;

      // Reabrir si estaba cerrada
      if (liqExistente.consignacion.estado === "CERRADA") {
        await tx.consignacion.update({
          where: { id: consignacionId },
          data: { estado: "ABIERTA" },
        });
      }

      // --- 1) REVERTIR ITEMS ANTERIORES ---
      for (const item of liqExistente.items) {
        const det = liqExistente.consignacion.detalles.find(
          (d) => d.id === item.consignacionDetalleId,
        );
        if (!det) continue;

        await tx.consignacionDetalle.update({
          where: { id: item.consignacionDetalleId },
          data: {
            unitsVendidasAcum: { decrement: item.unitsVendidas },
            unitsDevueltasAcum: { decrement: item.unitsDevueltas },
          },
        });

        const productoAntes = await tx.producto.findUnique({
          where: { id: det.productoId },
        });
        if (!productoAntes)
          throw new Error(`PRODUCTO_NO_ENCONTRADO:${det.productoId}`);

        // Sincronizar StockSucursal (reverso)
        await tx.stockSucursal.update({
          where: {
            productoId_sucursalId: {
              productoId: det.productoId,
              sucursalId: liqExistente.consignacion.sucursalId,
            },
          },
          data: {
            stockConsignadoUnits: {
              increment: item.unitsVendidas + item.unitsDevueltas,
            },
            ...(item.unitsDevueltas > 0
              ? { stockDisponibleUnits: { decrement: item.unitsDevueltas } }
              : {}),
          },
        });

        const productoDespues = await applyProductoGlobalDelta(
          tx,
          stockAuthority,
          {
            productoId: det.productoId,
            disponibleDelta: -item.unitsDevueltas,
            consignadoDelta: item.unitsVendidas + item.unitsDevueltas,
          },
        );

        // Auditoría Reversa: Lo que se devolvió al almacén, ahora se "des-devuelve" (Sale)
        if (item.unitsDevueltas > 0) {
          await tx.movimientoStock.create({
            data: {
              productoId: det.productoId,
              tipo: TipoMovimientoStock.SALIDA,
              motivo: MotivoMovimientoStock.AJUSTE_NEGATIVO,
              cantidad: item.unitsDevueltas,
              stockPrevio: productoAntes.stockDisponibleUnits,
              stockPosterior: productoDespues.stockDisponibleUnits,
              observaciones: `Reverso Devolución Liq #${liquidacionId} (Consignación #${consignacionId})`,
            },
          });
        }

        // Auditoría Reversa: Lo que se había "vendido", ahora "vuelve" virtualmente (Entra a consignado, no a disponible, pero dejamos registro)
        if (item.unitsVendidas > 0) {
          await tx.movimientoStock.create({
            data: {
              productoId: det.productoId,
              tipo: TipoMovimientoStock.ENTRADA, // Entra lógicamente al sistema de nuevo
              motivo: MotivoMovimientoStock.AJUSTE_POSITIVO,
              cantidad: item.unitsVendidas,
              stockPrevio: productoAntes.stockDisponibleUnits,
              stockPosterior: productoDespues.stockDisponibleUnits, // No cambia el disponible, pero documentamos
              observaciones: `Reverso Venta Liq #${liquidacionId} (Consignación #${consignacionId})`,
            },
          });
        }
      }

      // Revertir venta y saldo
      if (liqExistente.venta) {
        // Tomar la autoridad de numeración sólo después de los locks de stock,
        // igual que el resto de writers, para no invertir el orden global.
        await assertVentaNumberingAuthority(tx);
        await tx.cliente.update({
          where: { id: liqExistente.consignacion.clienteId },
          data: { saldoCuenta: { decrement: liqExistente.venta.total } },
        });
        await tx.venta.delete({ where: { id: liqExistente.venta.id } });
      }

      // Borrar items viejos
      await tx.liquidacionItem.deleteMany({ where: { liquidacionId } });

      // --- 2) PREPARAR Y APLICAR NUEVOS DATOS ---
      const detallesMap = new Map(
        liqExistente.consignacion.detalles.map((d) => [d.id, d]),
      );
      let nuevoTotalVenta = 0;
      const soldByProduct = new Map<
        number,
        { units: number; precioUnitario: number }
      >();

      for (const it of parsed.data.items) {
        const det = detallesMap.get(it.consignacionDetalleId);
        if (!det) throw new Error("DETALLE_NO_PERTENECE");

        const vendidas = it.unitsVendidas ?? 0;
        const devueltas = it.unitsDevueltas ?? 0;

        const freshDet = await tx.consignacionDetalle.findUniqueOrThrow({
          where: { id: det.id },
        });
        if (
          !validateSettlement({
            unitsEntregadas: freshDet.unitsEntregadas,
            unitsVendidasAcum: freshDet.unitsVendidasAcum,
            unitsDevueltasAcum: freshDet.unitsDevueltasAcum,
            unitsVendidas: vendidas,
            unitsDevueltas: devueltas,
          }).ok
        )
          throw new Error(`EXCEDE_PENDIENTE:${det.id}`);

        const precioUnit = Number(det.producto.precioVenta);

        if (vendidas > 0) {
          nuevoTotalVenta += vendidas * precioUnit;
          const prev = soldByProduct.get(det.productoId);
          soldByProduct.set(det.productoId, {
            units: (prev?.units ?? 0) + vendidas,
            precioUnitario: precioUnit,
          });
        }

        // Aplicar nuevos contadores (sólo si todavía alcanza)
        if (
          !(await claimSettlementUnits(tx, {
            consignacionDetalleId: det.id,
            unitsVendidas: vendidas,
            unitsDevueltas: devueltas,
          }))
        ) {
          throw new Error(`EXCEDE_PENDIENTE:${det.id}`);
        }

        const productoAntes = await tx.producto.findUnique({
          where: { id: det.productoId },
        });
        if (!productoAntes)
          throw new Error(`PRODUCTO_NO_ENCONTRADO:${det.productoId}`);

        // Sincronizar StockSucursal
        await tx.stockSucursal.update({
          where: {
            productoId_sucursalId: {
              productoId: det.productoId,
              sucursalId: liqExistente.consignacion.sucursalId,
            },
          },
          data: {
            stockConsignadoUnits: { decrement: vendidas + devueltas },
            ...(devueltas > 0
              ? { stockDisponibleUnits: { increment: devueltas } }
              : {}),
          },
        });

        // Aplicar nuevo stock global según la autoridad
        const productoDespues = await applyProductoGlobalDelta(
          tx,
          stockAuthority,
          {
            productoId: det.productoId,
            disponibleDelta: devueltas,
            consignadoDelta: -(vendidas + devueltas),
          },
        );

        // Auditoría Nuevo: Devolución (Entra stock disponible)
        if (devueltas > 0) {
          await tx.movimientoStock.create({
            data: {
              productoId: det.productoId,
              tipo: TipoMovimientoStock.ENTRADA,
              motivo: MotivoMovimientoStock.DEVOLUCION_CLIENTE,
              cantidad: devueltas,
              stockPrevio: productoAntes.stockDisponibleUnits,
              stockPosterior: productoDespues.stockDisponibleUnits,
              observaciones: `Devolución Corregida Liq #${liquidacionId}`,
            },
          });
        }

        // Auditoría Nuevo: Venta (Sale definitivamente)
        if (vendidas > 0) {
          await tx.movimientoStock.create({
            data: {
              productoId: det.productoId,
              tipo: TipoMovimientoStock.SALIDA,
              motivo: MotivoMovimientoStock.VENTA,
              cantidad: vendidas,
              stockPrevio: productoAntes.stockDisponibleUnits,
              stockPosterior: productoDespues.stockDisponibleUnits,
              observaciones: `Venta Corregida Liq #${liquidacionId}`,
            },
          });
        }

        // Evaluar alertas por los nuevos movimientos
        const alerta = deps.evaluateStockAlert(productoDespues, configGlobal);
        if (alerta) notificationsQueue.push(alerta);
      }

      // 3) Recrear items de liquidación
      await tx.liquidacionItem.createMany({
        data: parsed.data.items.map((it) => ({
          liquidacionId,
          consignacionDetalleId: it.consignacionDetalleId,
          unitsVendidas: it.unitsVendidas ?? 0,
          unitsDevueltas: it.unitsDevueltas ?? 0,
          precioUnitario: detallesMap.get(it.consignacionDetalleId)!.producto
            .precioVenta,
        })),
      });

      // 4) Crear nueva venta y saldo
      if (nuevoTotalVenta > 0) {
        await createVentaWithAuthority(tx, {
          data: {
            clienteId: liqExistente.consignacion.clienteId,
            liquidacionId,
            total: nuevoTotalVenta,
            sucursalId: liqExistente.consignacion.sucursalId,
            tipo: "LIQUIDACION",
            detalles: {
              create: Array.from(soldByProduct.entries()).map(
                ([productoId, info]) => ({
                  productoId,
                  units: info.units,
                  precioUnitario: info.precioUnitario,
                  subtotal: info.units * info.precioUnitario,
                }),
              ),
            },
          },
          include: { detalles: true },
        });

        await tx.cliente.update({
          where: { id: liqExistente.consignacion.clienteId },
          data: { saldoCuenta: { increment: nuevoTotalVenta } },
        });
      }

      // 5) Recalcular cierre
      const detallesFinales = await tx.consignacionDetalle.findMany({
        where: { consignacionId },
      });
      const quedaPendiente = detallesFinales.some(
        (d) => calculatePendingUnits(d) > 0,
      );

      if (!quedaPendiente) {
        await tx.consignacion.update({
          where: { id: consignacionId },
          data: { estado: "CERRADA" },
        });
      }

      // 6) Retornar liquidación COMPLETA
      return await tx.liquidacion.findUnique({
        where: { id: liquidacionId },
        include: {
          items: { include: { detalle: { include: { producto: true } } } },
          venta: { include: { detalles: true } },
          consignacion: {
            include: {
              cliente: true,
              detalles: { include: { producto: true } },
            },
          },
        },
      });
    });

    // ✅ DISPARAR ALERTAS (Centralizado)
    await deps.processNotificationQueue(
      notificationsQueue,
      auth.activeSucursalId,
    );

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof StockAuthorityError) {
      console.error("Autoridad de stock rechazada:", error.code);
      return NextResponse.json(
        { error: "Autoridad de stock no disponible." },
        { status: 503 },
      );
    }
    const msg = error instanceof Error ? error.message : "";
    if (msg === "LIQUIDACION_NO_ENCONTRADA")
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    if (msg === "DETALLE_NO_PERTENECE")
      return NextResponse.json({ error: "Detalle inválido" }, { status: 400 });
    if (msg.startsWith("PRODUCTO_NO_ENCONTRADO:")) {
      return NextResponse.json(
        { error: "Producto asociado no encontrado" },
        { status: 409 },
      );
    }
    if (msg.startsWith("EXCEDE_PENDIENTE:")) {
      return NextResponse.json(
        { error: "Excede el pendiente", detalleId: Number(msg.split(":")[1]) },
        { status: 409 },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}
