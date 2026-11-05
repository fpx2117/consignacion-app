// Valores derivados de una factura de proveedor y sus ítems.
//
// Extraído de factura-proveedor-dialog.tsx (M21) sin cambios de comportamiento:
// memoización, conversión de moneda, conteos por filtro, progreso y el efecto que
// mantiene `totalDetectado` sincronizado con la suma de líneas.

import * as React from "react";

import type {
  FacturaProveedor,
  FacturaProveedorItem,
  UpdateFacturaProveedorInput,
} from "@/lib/apiService";

import type { CreateProductoInitialValues } from "./create-producto-dialog";
import {
  ESTADOS_TERMINALES,
  bucketsDeItem,
  inferirCodigoBarra,
  normalizarNombreSugerido,
  type FacturaProveedorItemConCatalogoGlobal,
  type FiltroFactura,
} from "./factura-proveedor-helpers";

export type UseFacturaDerivadosOptions = {
  factura: FacturaProveedor | null;
  items: FacturaProveedorItem[] | null;
  monedaFactura: string;
  cotizacionDolar: number | null;
  filtroActivo: FiltroFactura;
  precioVentaBorrador: Record<number, number | null>;
  guardarCampoFactura: (patch: UpdateFacturaProveedorInput) => Promise<void>;
};

export function useFacturaDerivados({
  factura,
  items,
  monedaFactura,
  cotizacionDolar,
  filtroActivo,
  precioVentaBorrador,
  guardarCampoFactura,
}: UseFacturaDerivadosOptions) {
  function initialValuesParaNuevoProducto(
    item: FacturaProveedorItemConCatalogoGlobal,
  ): CreateProductoInitialValues {
    // El costo final que persiste el backend siempre queda en ARS (ver
    // create-product/route.ts) — acá sólo se prellena una estimación con la
    // cotización del momento para que el campo no se vea con un número en
    // USD sin aclarar. El valor real, autoritativo, lo calcula el backend.
    const moneda = (factura?.moneda ?? "ARS").trim().toUpperCase();
    const precioEstimadoArs =
      item.precioUnitario != null && moneda === "USD" && cotizacionDolar
        ? item.precioUnitario * cotizacionDolar
        : (item.precioUnitario ?? undefined);

    return {
      // Si hay una sugerencia del catálogo global, su nombre normalizado es
      // más limpio que el texto OCR crudo — pero sigue siendo editable, no se
      // fuerza nada (ver openspec/changes/catalogo-global-api).
      nombre: normalizarNombreSugerido(
        item.candidatoGlobalNombre ?? item.textoOriginal,
      ),
      precioCosto: precioEstimadoArs,
      precioVenta: precioVentaBorrador[item.id] ?? undefined,
      stockDisponibleUnits: item.cantidad,
      codigoBarra: inferirCodigoBarra(item) ?? item.candidatoGlobalCodigoBarras,
    };
  }

  const facturaBloqueada =
    factura?.estado === "CONFIRMADA" || factura?.estado === "CANCELADA";

  // La factura puede venir en una moneda extranjera (ej. USD). Para que el
  // usuario vea siempre los precios en pesos, se convierte en vivo con la
  // cotización del dólar blue. El backend hace la conversión autoritativa al
  // confirmar; acá es solo visual.
  const facturaEnMonedaExtranjera = monedaFactura !== "ARS";
  const puedeConvertir = facturaEnMonedaExtranjera && !!cotizacionDolar;

  function convertirAArs(valor: number | null | undefined): number | null {
    if (valor == null) return null;
    if (!facturaEnMonedaExtranjera) return valor;
    return cotizacionDolar ? valor * cotizacionDolar : null;
  }

  function formatearArs(valor: number): string {
    return `$${valor.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  }

  // Líneas que realmente cuentan para el total/cantidad — un item ignorado
  // fue descartado explícitamente por el usuario porque no correspondía a
  // esta compra, así que no debe sumar.
  const itemsValidos = React.useMemo(
    () => (items ?? []).filter((i) => i.estado !== "IGNORADO"),
    [items],
  );

  // Total autocalculado a partir de las líneas (cantidad × costo unitario) —
  // no lo tipea el usuario: siempre refleja la suma real de lo que se está
  // cargando, y se recalcula solo si edita cantidad o costo de algún item.
  const totalCalculado = React.useMemo(
    () =>
      itemsValidos.reduce(
        (acc, i) => acc + i.cantidad * (i.precioUnitario ?? 0),
        0,
      ),
    [itemsValidos],
  );

  const cantidadTotalUnidades = itemsValidos.reduce(
    (acc, i) => acc + i.cantidad,
    0,
  );

  // Conteos por bucket para los chips de filtro y el resumen lateral.
  const conteos = React.useMemo(() => {
    const base: Record<FiltroFactura, number> = {
      todos: 0,
      pendiente: 0,
      confirmado: 0,
      "sin-match": 0,
      advertencia: 0,
    };
    for (const item of items ?? []) {
      base.todos += 1;
      for (const b of bucketsDeItem(item)) base[b] += 1;
    }
    return base;
  }, [items]);

  const itemsFiltrados = React.useMemo(() => {
    const lista = items ?? [];
    if (filtroActivo === "todos") return lista;
    return lista.filter((i) => bucketsDeItem(i).includes(filtroActivo));
  }, [items, filtroActivo]);

  // Progreso: cuántas líneas ya quedaron resueltas (confirmadas, con producto
  // creado o ignoradas) sobre el total detectado.
  const totalLineas = (items ?? []).length;
  const lineasResueltas = (items ?? []).filter((i) =>
    ESTADOS_TERMINALES.has(i.estado),
  ).length;
  const progresoPct =
    totalLineas > 0 ? Math.round((lineasResueltas / totalLineas) * 100) : 0;

  // Mantiene factura.totalDetectado sincronizado con la suma de líneas.
  React.useEffect(() => {
    if (!factura || !items || facturaBloqueada) return;
    const actual = factura.totalDetectado ?? 0;
    // Redondeo a centavos para no disparar el PATCH por errores de punto flotante.
    if (Math.round(actual * 100) === Math.round(totalCalculado * 100)) return;
    guardarCampoFactura({ totalDetectado: totalCalculado });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- guardarCampoFactura no es estable entre renders; sólo debe dispararse cuando cambia el total calculado o la factura activa.
  }, [totalCalculado, factura?.id, facturaBloqueada]);

  // El código de proveedor no se muestra por separado si ya viene embebido en
  // la descripción detectada (evita duplicar el dato en pantalla).
  function codigoYaEnDescripcion(item: FacturaProveedorItem): boolean {
    const cod = item.codigoProveedor?.trim();
    if (!cod) return false;
    return item.textoOriginal.toLowerCase().includes(cod.toLowerCase());
  }

  return {
    initialValuesParaNuevoProducto,
    facturaBloqueada,
    facturaEnMonedaExtranjera,
    puedeConvertir,
    convertirAArs,
    formatearArs,
    itemsValidos,
    totalCalculado,
    cantidadTotalUnidades,
    conteos,
    itemsFiltrados,
    totalLineas,
    lineasResueltas,
    progresoPct,
    codigoYaEnDescripcion,
  };
}
