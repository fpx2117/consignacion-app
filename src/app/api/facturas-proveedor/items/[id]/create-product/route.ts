// src/app/api/facturas-proveedor/items/[id]/create-product/route.ts
// Crea un producto nuevo a partir de un item de factura sin coincidencia confiable.
// Reutiliza el mismo schema/límite de plan que POST /api/productos — el usuario
// revisa y confirma todos los campos antes de llegar acá (el prellenado ocurre en
// el frontend); este endpoint no inventa nada por su cuenta.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EstadoItemFactura, TipoMovimientoStock, MotivoMovimientoStock } from "@prisma/client";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { createProductoSchema, type CreateProductoInput } from "@/lib/validators/producto";
import { checkProductLimit } from "@/lib/subscriptions/require-subscription";
import { cargarItemFacturaAccesible } from "@/lib/ocr/cargar-item-factura";
import { registrarCostoYAlias, actualizarEstadoFacturaSiCompleta, convertirCostoAArs } from "@/lib/ocr/aplicar-confirmacion";

type ProductoCreateBody = CreateProductoInput & { subcategoriaId?: number | null };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No tienes permisos (Admin requerido)" }, { status: 403 });
  }

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Item de factura no encontrado" }, { status: 404 });
  }

  const productCheck = await checkProductLimit();
  if (!productCheck.allowed) {
    return NextResponse.json({ error: productCheck.message, limitReached: true }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as ProductoCreateBody | null;
  const parsed = createProductoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const cargado = await cargarItemFacturaAccesible(auth, itemId);
  if (!cargado.ok) {
    return NextResponse.json({ error: cargado.error }, { status: cargado.status });
  }
  const { item } = cargado;
  const sucursalId = item.factura.sucursalId;
  const data = parsed.data;
  const stockInicial = data.stockDisponibleUnits ?? 0;

  try {
    // data.precioCosto viene prellenado en el frontend desde item.precioUnitario,
    // en la moneda original de la factura (item.factura.moneda) salvo que el
    // usuario lo haya corregido a mano — de cualquier forma, el negocio quiere
    // el costo siempre en ARS.
    const conversion = await convertirCostoAArs(data.precioCosto, item.factura.moneda);

    const resultado = await prisma.$transaction(async (tx) => {
      const nuevoProducto = await tx.producto.create({
        data: {
          nombre: data.nombre,
          descripcion: data.descripcion,
          precioVenta: data.precioVenta,
          precioCosto: conversion.precioConvertido ?? data.precioCosto,
          monedaCosto: conversion.monedaFinal,
          iva: data.iva,
          stockDisponibleUnits: stockInicial,
          stockConsignadoUnits: 0,
          stockMinUnits: data.stockMinUnits ?? 0,
          packSizeUnits: data.packSizeUnits ?? null,
          codigoBarra: data.codigoBarra?.trim() || null,
          sku: data.sku?.trim() || null,
          categoriaId: data.categoriaId ?? null,
          subcategoriaId: body?.subcategoriaId ?? null,
          fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
          imagenUrl: data.imagenUrl || null,
          sucursalId,
          tipoDescuento: data.tipoDescuento ?? "porcentaje",
          descuentoPorcentaje: data.descuentoPorcentaje ?? null,
          descuentoMonto: data.descuentoMonto ?? null,
          descuentoActivo: data.descuentoActivo ?? false,
          descuentoDesde: data.descuentoDesde ? new Date(data.descuentoDesde) : null,
          descuentoHasta: data.descuentoHasta ? new Date(data.descuentoHasta) : null,
        },
      });

      await tx.stockSucursal.create({
        data: {
          productoId: nuevoProducto.id,
          sucursalId,
          stockDisponibleUnits: stockInicial,
          stockConsignadoUnits: 0,
          stockMinUnits: data.stockMinUnits ?? 0,
        },
      });

      if (stockInicial > 0) {
        await tx.movimientoStock.create({
          data: {
            productoId: nuevoProducto.id,
            sucursalId,
            tipo: TipoMovimientoStock.ENTRADA,
            motivo: MotivoMovimientoStock.COMPRA,
            cantidad: stockInicial,
            stockPrevio: 0,
            stockPosterior: stockInicial,
            observaciones: "Producto creado por OCR de factura de proveedor",
          },
        });
      }

      // El costo ya quedó seteado en el create de arriba (precioCosto ya convertido
      // a ARS si hacía falta). Igual pasamos por registrarCostoYAlias para dejar
      // HistorialCostoProducto + alias consistentes con el resto del flujo
      // (costoAnterior será null: producto recién creado).
      await registrarCostoYAlias(tx, {
        productoId: nuevoProducto.id,
        proveedorId: item.factura.proveedorId,
        facturaItemId: item.id,
        codigoProveedor: item.codigoProveedor,
        descripcionNormalizada: item.descripcionNormalizada,
        precioUnitario: conversion.precioConvertido ?? data.precioCosto,
        moneda: conversion.monedaFinal,
        productoNuevo: true,
      });

      const itemActualizado = await tx.facturaProveedorItem.update({
        where: { id: item.id },
        data: { productoId: nuevoProducto.id, estado: EstadoItemFactura.PRODUCTO_CREADO, matchMotivo: "manual" },
      });

      await actualizarEstadoFacturaSiCompleta(tx, item.facturaId);

      return { producto: nuevoProducto, item: itemActualizado };
    });

    return NextResponse.json(
      {
        data: resultado,
        tipoCambioAplicado: conversion.tipoCambioAplicado,
        advertenciaConversion: conversion.advertencia,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[FACTURA_PROVEEDOR_ITEM_CREATE_PRODUCT_ERROR]", { itemId, error });
    return NextResponse.json({ error: "Error al crear el producto" }, { status: 500 });
  }
}
