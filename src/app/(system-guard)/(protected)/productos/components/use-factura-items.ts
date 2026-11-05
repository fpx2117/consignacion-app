// Hook de estado y mutaciones de los ítems de una factura de proveedor.
//
// Extraído de factura-proveedor-dialog.tsx (M21) sin cambios de comportamiento:
// estado y handlers se movieron tal cual. Recibe la cotización del dólar y el
// callback de refresco porque los usa para convertir costos y avisar al padre.

import * as React from "react";
import { toast } from "sonner";

import {
  apiService,
  type FacturaProveedor,
  type FacturaProveedorItem,
  type UpdateFacturaProveedorInput,
  type UpdateFacturaProveedorItemInput,
} from "@/lib/apiService";

export type UseFacturaItemsOptions = {
  cotizacionDolar: number | null;
  onCreated?: () => void;
};

export function useFacturaItems({
  cotizacionDolar,
  onCreated,
}: UseFacturaItemsOptions) {
  const [factura, setFactura] = React.useState<FacturaProveedor | null>(null);
  const [items, setItems] = React.useState<FacturaProveedorItem[] | null>(null);
  const [busyItemId, setBusyItemId] = React.useState<number | null>(null);
  const [confirmandoTodos, setConfirmandoTodos] = React.useState(false);

  const monedaFactura = (factura?.moneda ?? "ARS").trim().toUpperCase();

  function updateItem(itemId: number, patch: Partial<FacturaProveedorItem>) {
    setItems(
      (prev) =>
        prev?.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) ?? null,
    );
  }

  // Todos los campos detectados por OCR/IA son editables antes de confirmar:
  // guarda optimistamente en el estado local y persiste con un PATCH al perder foco.
  function updateFacturaLocal(patch: Partial<FacturaProveedor>) {
    setFactura((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function guardarCampoFactura(patch: UpdateFacturaProveedorInput) {
    if (!factura) return;
    updateFacturaLocal(patch as Partial<FacturaProveedor>);
    try {
      const actualizada = await apiService.updateFacturaProveedor(
        factura.id,
        patch,
      );
      setFactura(actualizada);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el cambio",
      );
    }
  }

  async function guardarCampoItem(
    item: FacturaProveedorItem,
    patch: UpdateFacturaProveedorItemInput,
  ) {
    updateItem(item.id, patch as Partial<FacturaProveedorItem>);
    try {
      const actualizado = await apiService.updateFacturaProveedorItem(
        item.id,
        patch,
      );
      updateItem(item.id, actualizado);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el cambio",
      );
    }
  }

  // Al cambiar la moneda de la factura entre ARS y USD, los costos unitarios
  // ya cargados quedan expresados en la moneda vieja — hay que re-expresarlos
  // en la nueva usando la cotización del dólar blue, así el costo real no
  // cambia, solo la moneda en la que se muestra/persiste.
  async function cambiarMonedaFactura(nuevaMoneda: string) {
    const monedaAnterior = monedaFactura;
    if (nuevaMoneda === monedaAnterior) return;

    const esConversionSoportada =
      (monedaAnterior === "USD" && nuevaMoneda === "ARS") ||
      (monedaAnterior === "ARS" && nuevaMoneda === "USD");

    if (esConversionSoportada && items && items.length > 0) {
      if (!cotizacionDolar) {
        toast.warning(
          "No se pudo obtener la cotización del dólar — los costos unitarios no se convirtieron.",
        );
      } else {
        const factor =
          monedaAnterior === "USD" ? cotizacionDolar : 1 / cotizacionDolar;
        await Promise.all(
          items.map((item) => {
            if (item.precioUnitario == null) return Promise.resolve();
            const convertido =
              Math.round(item.precioUnitario * factor * 100) / 100;
            return guardarCampoItem(item, { precioUnitario: convertido });
          }),
        );
        toast.message(
          `Costos unitarios convertidos de ${monedaAnterior} a ${nuevaMoneda}`,
        );
      }
    }

    await guardarCampoFactura({ moneda: nuevaMoneda });
  }

  async function confirmarItem(
    item: FacturaProveedorItem,
    productoIdElegido?: number,
  ) {
    const productoId = productoIdElegido ?? item.productoId;
    if (!productoId) {
      toast.error("Elegí un producto antes de confirmar");
      return;
    }
    setBusyItemId(item.id);
    try {
      const resultado = await apiService.confirmFacturaProveedorItem(
        item.id,
        productoId,
      );
      updateItem(item.id, resultado.data);
      if (resultado.variacionCosto.alerta === "alerta_fuerte") {
        toast.warning(
          `El costo varió más del 40% respecto al histórico para "${item.textoOriginal}"`,
        );
      } else if (resultado.variacionCosto.alerta === "advertencia") {
        toast.message(
          `El costo varió respecto al histórico para "${item.textoOriginal}"`,
        );
      }
      if (resultado.tipoCambioAplicado) {
        toast.message(
          `Costo convertido a ARS con cotización $${resultado.tipoCambioAplicado.toLocaleString("es-AR")}`,
        );
      } else if (resultado.advertenciaConversion) {
        toast.warning(resultado.advertenciaConversion);
      }
      onCreated?.();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al confirmar el item",
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function ignorarItem(item: FacturaProveedorItem) {
    setBusyItemId(item.id);
    try {
      const actualizado = await apiService.ignoreFacturaProveedorItem(item.id);
      updateItem(item.id, actualizado);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al ignorar el item",
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function confirmarTodosSeguros() {
    if (!factura) return;
    setConfirmandoTodos(true);
    try {
      const resultado = await apiService.confirmAllFacturaProveedor(factura.id);
      if (resultado.confirmados > 0)
        toast.success(`${resultado.confirmados} producto(s) confirmado(s)`);
      if (resultado.errores.length > 0) {
        resultado.errores.forEach((e) =>
          toast.error(`Item ${e.itemId}: ${e.error}`),
        );
      }
      const facturaActualizada = await apiService.getFacturaProveedor(
        factura.id,
      );
      setFactura(facturaActualizada);
      setItems(facturaActualizada.items ?? []);
      onCreated?.();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al confirmar en lote",
      );
    } finally {
      setConfirmandoTodos(false);
    }
  }

  return {
    factura,
    setFactura,
    items,
    setItems,
    busyItemId,
    confirmandoTodos,
    monedaFactura,
    updateItem,
    updateFacturaLocal,
    guardarCampoFactura,
    guardarCampoItem,
    cambiarMonedaFactura,
    confirmarItem,
    ignorarItem,
    confirmarTodosSeguros,
  };
}
