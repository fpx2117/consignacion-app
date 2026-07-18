"use client";

import * as React from "react";
import {
  ProductoWizardDialog,
  type ProductoEditable,
} from "./producto-wizard-dialog";

export function EditProductoDialog({
  trigger,
  producto,
  onUpdated,
  onCategoriasChanged,
  open,
  onOpenChange,
}: {
  trigger: React.ReactNode;
  producto: ProductoEditable;
  onUpdated?: () => void;
  /** Notifica al padre cuando se crea/edita/elimina una categoría desde este dialog. */
  onCategoriasChanged?: () => void;
  /** Control externo opcional (ej. para trackear si este dialog anidado está
   * abierto desde un padre, y así evitar que un Escape/click-afuera dentro
   * de este dialog cierre en cascada el dialog padre). Sin estos props, el
   * componente sigue siendo no controlado como antes. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <ProductoWizardDialog
      mode="edit"
      trigger={trigger}
      producto={producto}
      onUpdated={onUpdated}
      onCategoriasChanged={onCategoriasChanged}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
