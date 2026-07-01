// src/lib/ocr/aplicar-confirmacion.ts
// Lógica compartida por los endpoints de confirmación de items de factura
// (confirm, create-product, confirm-all): suma stock, registra costo/historial y
// guarda el alias proveedor→producto. Todo corre dentro de la misma transacción
// que crea/actualiza el producto — nunca se llama fuera de un `$transaction`.
//
// Reglas de negocio (no negociables, ver spec):
//   - El precio de factura es costo de compra, NUNCA precio de venta.
//   - precioVenta no se toca acá bajo ninguna circunstancia.
//   - El alias sólo se guarda si la factura ya tiene proveedor asignado.

import type { Prisma } from "@prisma/client";
import { TipoMovimientoStock, MotivoMovimientoStock } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export type AlertaVariacionCosto = "normal" | "advertencia" | "alerta_fuerte" | null;

export function calcularVariacionCosto(
  costoAnterior: number | null,
  costoNuevo: number,
): { variacionPct: number | null; alerta: AlertaVariacionCosto } {
  if (costoAnterior === null || costoAnterior <= 0) {
    return { variacionPct: null, alerta: null };
  }
  const variacionPct = ((costoNuevo - costoAnterior) / costoAnterior) * 100;
  const abs = Math.abs(variacionPct);
  const alerta: AlertaVariacionCosto = abs > 40 ? "alerta_fuerte" : abs > 15 ? "advertencia" : "normal";
  return { variacionPct, alerta };
}

/** Suma stock a un producto existente en la sucursal, generando el MovimientoStock. Mismo patrón que confirmar/route.ts. */
export async function aplicarMovimientoStock(
  tx: TxClient,
  params: { productoId: number; sucursalId: number; cantidad: number; observaciones: string },
) {
  const stockActual = await tx.stockSucursal.findUnique({
    where: { productoId_sucursalId: { productoId: params.productoId, sucursalId: params.sucursalId } },
  });

  const stockPrevio = stockActual?.stockDisponibleUnits ?? 0;
  const stockPosterior = stockPrevio + params.cantidad;

  await tx.stockSucursal.upsert({
    where: { productoId_sucursalId: { productoId: params.productoId, sucursalId: params.sucursalId } },
    create: {
      productoId: params.productoId,
      sucursalId: params.sucursalId,
      stockDisponibleUnits: stockPosterior,
      stockConsignadoUnits: 0,
      stockMinUnits: 0,
    },
    update: { stockDisponibleUnits: stockPosterior },
  });

  const todosStocks = await tx.stockSucursal.findMany({
    where: { productoId: params.productoId },
    select: { stockDisponibleUnits: true },
  });
  const stockGlobal = todosStocks.reduce((acc, s) => acc + (s.stockDisponibleUnits ?? 0), 0);

  await tx.producto.update({
    where: { id: params.productoId },
    data: { stockDisponibleUnits: stockGlobal },
  });

  await tx.movimientoStock.create({
    data: {
      productoId: params.productoId,
      sucursalId: params.sucursalId,
      tipo: TipoMovimientoStock.ENTRADA,
      motivo: MotivoMovimientoStock.COMPRA,
      cantidad: params.cantidad,
      stockPrevio,
      stockPosterior,
      observaciones: params.observaciones,
    },
  });
}

/**
 * Actualiza el costo del producto (precioCosto + ultimoCostoCompra), registra
 * HistorialCostoProducto y guarda/actualiza el alias proveedor→producto. No hace
 * nada con precioVenta. Si `precioUnitario` es null (la factura no traía precio
 * para esa línea), sólo guarda el alias.
 */
export async function registrarCostoYAlias(
  tx: TxClient,
  params: {
    productoId: number;
    proveedorId: number | null;
    facturaItemId: number;
    codigoProveedor: string | null;
    descripcionNormalizada: string | null;
    precioUnitario: number | null;
    moneda: string;
    /**
     * Producto recién creado en esta misma transacción: no hay costo "anterior"
     * real que comparar (precioCosto ya quedó seteado al crearlo), así que se
     * fuerza costoAnterior=null en vez de leerlo de vuelta de la DB — si no, la
     * variación siempre daría 0% en lugar de "sin histórico".
     */
    productoNuevo?: boolean;
  },
): Promise<{ variacionPct: number | null; alerta: AlertaVariacionCosto }> {
  let variacion: { variacionPct: number | null; alerta: AlertaVariacionCosto } = { variacionPct: null, alerta: null };

  if (params.precioUnitario !== null && params.precioUnitario >= 0) {
    let costoAnterior: number | null = null;
    if (!params.productoNuevo) {
      const producto = await tx.producto.findUniqueOrThrow({
        where: { id: params.productoId },
        select: { precioCosto: true },
      });
      costoAnterior = Number(producto.precioCosto);
    }
    variacion = calcularVariacionCosto(costoAnterior, params.precioUnitario);

    await tx.producto.update({
      where: { id: params.productoId },
      data: {
        precioCosto: params.precioUnitario,
        ultimoCostoCompra: params.precioUnitario,
        monedaCosto: params.moneda,
        fechaUltimaCompra: new Date(),
      },
    });

    await tx.historialCostoProducto.create({
      data: {
        productoId: params.productoId,
        proveedorId: params.proveedorId,
        facturaItemId: params.facturaItemId,
        costoAnterior,
        costoNuevo: params.precioUnitario,
        moneda: params.moneda,
        variacionPct: variacion.variacionPct,
      },
    });
  }

  if (params.proveedorId) {
    if (params.codigoProveedor) {
      await tx.productoProveedorAlias.upsert({
        where: { proveedorId_codigoProveedor: { proveedorId: params.proveedorId, codigoProveedor: params.codigoProveedor } },
        create: {
          proveedorId: params.proveedorId,
          productoId: params.productoId,
          codigoProveedor: params.codigoProveedor,
          textoNormalizado: params.descripcionNormalizada,
        },
        update: {
          productoId: params.productoId,
          usoCount: { increment: 1 },
        },
      });
    } else if (params.descripcionNormalizada) {
      const existente = await tx.productoProveedorAlias.findFirst({
        where: {
          proveedorId: params.proveedorId,
          textoNormalizado: params.descripcionNormalizada,
          codigoProveedor: null,
        },
      });
      if (existente) {
        await tx.productoProveedorAlias.update({
          where: { id: existente.id },
          data: { productoId: params.productoId, usoCount: { increment: 1 } },
        });
      } else {
        await tx.productoProveedorAlias.create({
          data: {
            proveedorId: params.proveedorId,
            productoId: params.productoId,
            textoNormalizado: params.descripcionNormalizada,
          },
        });
      }
    }
  }

  return variacion;
}

export type ConversionMonedaResultado = {
  /** Costo ya convertido, listo para persistir. Null si `precioUnitario` era null. */
  precioConvertido: number | null;
  /** Moneda en la que efectivamente queda el costo ("ARS" salvo que no haya cotización disponible). */
  monedaFinal: string;
  /** Cotización usada, o null si no hubo conversión (ya era ARS, o no hay tasa para esa moneda). */
  tipoCambioAplicado: number | null;
  /** Mensaje para mostrarle al usuario si no se pudo convertir (no bloquea la confirmación). */
  advertencia: string | null;
};

/**
 * El negocio quiere el costo siempre en ARS. Si la factura ya está en ARS, no
 * hay nada que hacer. Si está en USD, se convierte con la cotización del dólar
 * blue (misma fuente que ya usa el resto del SaaS para pricing, ver
 * `subscriptions/plans/route.ts`). Cualquier otra moneda no tiene cotización
 * disponible acá — se guarda tal cual y se avisa, en vez de fallar la
 * confirmación completa por un dato que la factura ni siquiera controla.
 *
 * Se llama ANTES de abrir el `$transaction` de confirm/create-product: hace un
 * fetch externo, y un HTTP call dentro de una transacción de DB arriesga
 * timeouts/locks innecesarios.
 */
export async function convertirCostoAArs(
  precioUnitario: number | null,
  monedaOrigen: string,
): Promise<ConversionMonedaResultado> {
  const moneda = monedaOrigen.trim().toUpperCase();

  if (moneda === "ARS" || precioUnitario === null) {
    return { precioConvertido: precioUnitario, monedaFinal: "ARS", tipoCambioAplicado: null, advertencia: null };
  }

  if (moneda === "USD") {
    const { fetchDolarBlue } = await import("@/lib/integrations/dolarBlue");
    const tipoCambio = await fetchDolarBlue();
    return {
      precioConvertido: precioUnitario * tipoCambio,
      monedaFinal: "ARS",
      tipoCambioAplicado: tipoCambio,
      advertencia: null,
    };
  }

  return {
    precioConvertido: precioUnitario,
    monedaFinal: moneda,
    tipoCambioAplicado: null,
    advertencia: `No hay cotización disponible para convertir ${moneda} a ARS: el costo se guardó en ${moneda}.`,
  };
}

/** Si todos los items de la factura quedaron en un estado terminal, marca la factura como CONFIRMADA. */
export async function actualizarEstadoFacturaSiCompleta(tx: TxClient, facturaId: number) {
  const pendientes = await tx.facturaProveedorItem.count({
    where: {
      facturaId,
      estado: { notIn: ["CONFIRMADO", "PRODUCTO_CREADO", "IGNORADO", "ERROR"] },
    },
  });

  if (pendientes === 0) {
    await tx.facturaProveedor.update({
      where: { id: facturaId },
      data: { estado: "CONFIRMADA" },
    });
  }
}
